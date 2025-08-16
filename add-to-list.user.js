// ==UserScript==
// @name         X (Twitter) List Import
// @namespace    https://github.com/aeft/QuickXListAdder
// @version      1.0.3
// @description  Automatically add multiple users to X (Twitter) lists
// @author       Alex Wang
// @match        https://x.com/i/lists/*
// @match        https://twitter.com/i/lists/*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        addOffset: { x: 8, y: 6 },
        waitTimeout: 6000,
        actionDelay: 2000, // Delay between actions to avoid rate limiting
        searchDelay: 1500,   // Delay after typing before searching
        // Element checking and polling intervals
        elementCheckInterval: 100, // Interval for checking if elements exist
        // Navigation timeouts
        editButtonTimeout: 5000, // Timeout for finding edit list button
        suggestedTabTimeout: 5000, // Timeout for finding suggested tab
        searchInputTimeout: 5000, // Timeout for finding search input in navigation
        addUserSearchTimeout: 3000, // Timeout for finding search input when adding user
        // Navigation delays
        navigationDelay: 1000, // Delay after navigation actions
        pivotDelay: 1000, // Delay after clicking pivot element
        suggestedTabDelay: 2000, // Delay after clicking suggested tab
        inputClearDelay: 100, // Delay after clearing input field
        // Button verification
        buttonVerificationTimeout: 3000, // Timeout for verifying button status change
        buttonVerificationInterval: 200 // Interval for checking button status change
    };

    const SELECTORS = {
        addButtons: [
            'button[aria-label="Add"]',
            'button:has(span:contains("Add"))',
            '[data-testid="TypeaheadUser"] button',
            'button span:contains("Add")'
        ],
        searchInputs: [
            'input[aria-label*="Search"]',
            'input[placeholder*="Search"]',
            '#layers input',
            'form input[type="text"]'
        ],
        editListButton: [
            'a span:contains("Edit List")',
            '[data-testid="cellInnerDiv"] a span span'
        ],
        suggestedTab: [
            'a[href*="suggested"]',
            'div:contains("Suggested")'
        ]
    };

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function waitForElement(selectors, timeout = CONFIG.waitTimeout) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            function check() {
                for (const selector of selectors) {
                    let elements;

                    // Handle special selectors with text content
                    if (selector.includes(':contains(')) {
                        const [baseSelector, text] = selector.split(':contains(');
                        const searchText = text.replace(/[()'"]/g, '');
                        elements = [...document.querySelectorAll(baseSelector)].filter(el =>
                            el.textContent.includes(searchText)
                        );
                    } else if (selector.includes(':has(')) {
                        // Simple has implementation for buttons with Add text
                        if (selector.includes('button:has(span:contains("Add"))')) {
                            elements = [...document.querySelectorAll('button')].filter(btn =>
                                btn.querySelector('span') && btn.textContent.includes('Add')
                            );
                        } else {
                            elements = [...document.querySelectorAll(selector.split(':has(')[0])];
                        }
                    } else {
                        const element = document.querySelector(selector);
                        elements = element ? [element] : [];
                    }

                    const element = elements.find(el => el && el.offsetParent !== null);
                    if (element) {
                        resolve(element);
                        return;
                    }
                }

                if (Date.now() - startTime > timeout) {
                    reject(new Error('Element not found within timeout'));
                    return;
                }

                setTimeout(check, CONFIG.elementCheckInterval);
            }

            check();
        });
    }

    function clickElement(element, offset = CONFIG.addOffset) {
        const rect = element.getBoundingClientRect();
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + offset.x,
            clientY: rect.top + offset.y
        });
        element.dispatchEvent(event);
    }

    // Find user card and check if user already exists in list
    async function findUserCard(targetUsername, timeout = CONFIG.waitTimeout) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            function check() {
                // Look for user cards in the search results
                const userCards = document.querySelectorAll('[data-testid="TypeaheadUser"]');

                if (userCards.length > 0) {
                    const firstCard = userCards[0];

                    // Find username in the card
                    const usernameElement = firstCard.querySelector('[data-testid="User-Name"] a, [data-testid="User-Names"] a, a[href*="/"]');
                    if (usernameElement) {
                        const href = usernameElement.getAttribute('href');
                        const cardUsername = href ? href.replace('/', '').toLowerCase() : '';

                        // Check if this matches our target user
                        if (cardUsername === targetUsername.toLowerCase()) {
                            // Find the button in this card
                            const addButton = firstCard.querySelector('button[aria-label="Add"]');
                            const removeButton = firstCard.querySelector('button[aria-label="Remove"]');

                            if (removeButton) {
                                resolve({ status: 'already_exists', button: removeButton });
                            } else if (addButton) {
                                resolve({ status: 'can_add', button: addButton });
                            } else {
                                resolve({ status: 'no_button', button: null });
                            }
                            return;
                        }
                    }
                }

                if (Date.now() - startTime > timeout) {
                    reject(new Error('User card not found within timeout'));
                    return;
                }

                setTimeout(check, CONFIG.elementCheckInterval);
            }

            check();
        });
    }

    // Verify that button status changed after clicking
    async function verifyButtonStatusChange(targetUsername, timeout = CONFIG.buttonVerificationTimeout) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            function check() {
                // Look for user cards in the search results
                const userCards = document.querySelectorAll('[data-testid="TypeaheadUser"]');

                if (userCards.length > 0) {
                    const firstCard = userCards[0];

                    // Find username in the card
                    const usernameElement = firstCard.querySelector('[data-testid="User-Name"] a, [data-testid="User-Names"] a, a[href*="/"]');
                    if (usernameElement) {
                        const href = usernameElement.getAttribute('href');
                        const cardUsername = href ? href.replace('/', '').toLowerCase() : '';

                        // Check if this matches our target user
                        if (cardUsername === targetUsername.toLowerCase()) {
                            // Check for Remove button (indicates successful addition)
                            const removeButton = firstCard.querySelector('button[aria-label="Remove"]');
                            if (removeButton) {
                                resolve(true);
                                return;
                            }
                        }
                    }
                }

                if (Date.now() - startTime > timeout) {
                    resolve(false);
                    return;
                }

                setTimeout(check, CONFIG.buttonVerificationInterval);
            }

            check();
        });
    }

    // Main automation class
    class ListUserAdder {
        constructor() {
            this.isRunning = false;
            this.shouldStop = false;
            this.currentUsers = [];
            this.progress = { added: 0, failed: 0, skipped: 0, total: 0, failedUsers: [], skippedUsers: [] };
        }

        async navigateToSuggestedPage() {
            try {
                // Click Edit List button
                const editButton = await waitForElement(SELECTORS.editListButton, CONFIG.editButtonTimeout);
                clickElement(editButton);
                await sleep(CONFIG.navigationDelay);

                // Click on the pivot/tab area
                const pivotElement = document.querySelector('[data-testid="pivot"] > div');
                if (pivotElement) {
                    clickElement(pivotElement);
                    await sleep(CONFIG.pivotDelay);
                }

                // Click Suggested tab
                const suggestedTab = await waitForElement(SELECTORS.suggestedTab, CONFIG.suggestedTabTimeout);
                clickElement(suggestedTab);
                await sleep(CONFIG.suggestedTabDelay);

                // Focus search input
                const searchInput = await waitForElement(SELECTORS.searchInputs, CONFIG.searchInputTimeout);
                searchInput.focus();

                return true;
            } catch (error) {
                console.error('Failed to navigate to suggested page:', error);
                return false;
            }
        }

        async addUser(username) {
            try {
                // Remove @ prefix if present
                const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

                // Clear and set username using React-compatible method
                const searchInput = await waitForElement(SELECTORS.searchInputs, CONFIG.addUserSearchTimeout);
                searchInput.focus();

                // Get React's native input value setter
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    "value"
                ).set;

                // Clear the input first 
                nativeInputValueSetter.call(searchInput, '');
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('change', { bubbles: true }));

                await sleep(CONFIG.inputClearDelay);

                // Set the username 
                nativeInputValueSetter.call(searchInput, cleanUsername);
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('change', { bubbles: true }));

                await sleep(CONFIG.searchDelay);

                // Check user card and button status
                const userCard = await findUserCard(cleanUsername, CONFIG.waitTimeout);

                if (userCard.status === 'already_exists') {
                    console.log(`User ${username} already exists in the list, skipping`);
                    return 'skipped';
                } else if (userCard.status === 'can_add') {
                    clickElement(userCard.button);
                    await sleep(CONFIG.actionDelay);

                    // Verify that the button actually changed to "Remove"
                    const verificationSuccess = await verifyButtonStatusChange(cleanUsername);
                    if (verificationSuccess) {
                        console.log(`Successfully added user ${username} to the list`);
                        return 'added';
                    } else {
                        console.error(`Failed to verify addition of user ${username} - button did not change to Remove`);
                        return 'failed';
                    }
                } else {
                    console.error(`No valid button found for user ${username}`);
                    return 'failed';
                }

            } catch (error) {
                console.error(`Failed to add user ${username}:`, error);
                return 'failed';
            }
        }

        async addUsers(users) {
            if (this.isRunning) return;

            this.isRunning = true;
            this.currentUsers = users;
            this.progress = { added: 0, failed: 0, skipped: 0, total: users.length, failedUsers: [], skippedUsers: [] };

            this.updateUI();

            try {
                // Navigate to suggested members page
                const navigationSuccess = await this.navigateToSuggestedPage();
                if (!navigationSuccess) {
                    throw new Error('Failed to navigate to suggested members page');
                }

                // Add each user
                for (const user of users) {
                    // Check if user requested to stop
                    if (this.shouldStop) {
                        console.log('User requested to stop the process');
                        break;
                    }

                    const cleanUser = user.trim();
                    const result = await this.addUser(cleanUser);
                    if (result === 'added') {
                        this.progress.added++;
                    } else if (result === 'skipped') {
                        this.progress.skipped++;
                        this.progress.skippedUsers.push(cleanUser);
                    } else {
                        this.progress.failed++;
                        this.progress.failedUsers.push(cleanUser);
                    }
                    this.updateUI();
                }

            } catch (error) {
                console.error('Error during batch user addition:', error);
                alert(`Error: ${error.message}`);
            } finally {
                this.isRunning = false;
                this.shouldStop = false;
                this.updateUI();
            }
        }

        stop() {
            this.shouldStop = true;
        }

        updateUI() {
            const statusDiv = document.getElementById('x-list-adder-status');
            const startButton = document.getElementById('x-list-adder-start');
            const stopButton = document.getElementById('x-list-adder-stop');

            if (!statusDiv) return;

            if (this.isRunning) {
                statusDiv.textContent = `Adding users... ${this.progress.added}/${this.progress.total} added, ${this.progress.skipped} skipped, ${this.progress.failed} failed`;
                if (startButton) {
                    startButton.style.display = 'none';
                }
                if (stopButton) {
                    stopButton.style.display = 'inline-block';
                }
            } else {
                if (startButton) {
                    startButton.style.display = 'inline-block';
                }
                if (stopButton) {
                    stopButton.style.display = 'none';
                }

                if (this.progress.total > 0) {
                    let statusText = this.shouldStop ?
                        `Stopped: ${this.progress.added} added, ${this.progress.skipped} skipped (already in list), ${this.progress.failed} failed` :
                        `Completed: ${this.progress.added} added, ${this.progress.skipped} skipped (already in list), ${this.progress.failed} failed`;
                    if (this.progress.skipped > 0 && this.progress.skippedUsers.length > 0) {
                        statusText += `\nSkipped users: ${this.progress.skippedUsers.join(', ')}`;
                    }
                    if (this.progress.failed > 0 && this.progress.failedUsers.length > 0) {
                        statusText += `\nFailed users: ${this.progress.failedUsers.join(', ')}`;
                    }
                    statusDiv.textContent = statusText;
                } else {
                    statusDiv.textContent = 'Ready to add users';
                }
            }
        }
    }

    // UI Creation
    function createUI() {
        // Add styles
        GM_addStyle(`
            #x-list-adder-panel {
                position: fixed;
                top: 80px;
                right: 20px;
                width: 320px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(29, 161, 242, 0.2);
                border-radius: 16px;
                padding: 20px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 14px;
                transition: all 0.3s ease;
            }
            
            #x-list-adder-panel h3 {
                margin: 0 0 16px 0;
                color: #0f1419;
                font-size: 20px;
                font-weight: 800;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            #x-list-adder-panel h3::before {
                content: "👥";
                font-size: 18px;
            }
            
            #x-list-adder-panel textarea {
                width: 100%;
                height: 90px;
                border: 2px solid #e1e8ed;
                border-radius: 12px;
                padding: 12px;
                margin-bottom: 16px;
                resize: vertical;
                font-family: inherit;
                font-size: 14px;
                background: rgba(255, 255, 255, 0.8);
                transition: border-color 0.2s ease;
                line-height: 1.4;
            }
            
            #x-list-adder-panel textarea:focus {
                outline: none;
                border-color: #1da1f2;
                box-shadow: 0 0 0 3px rgba(29, 161, 242, 0.1);
            }
            
            #x-list-adder-panel textarea::placeholder {
                color: #657786;
            }
            
            #x-list-adder-panel button {
                background: linear-gradient(135deg, #1da1f2 0%, #0d8bd9 100%);
                color: white;
                border: none;
                border-radius: 20px;
                padding: 12px 20px;
                cursor: pointer;
                font-weight: 700;
                margin-right: 8px;
                margin-bottom: 8px;
                font-size: 14px;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(29, 161, 242, 0.3);
            }
            
            #x-list-adder-panel button:hover {
                background: linear-gradient(135deg, #0d8bd9 0%, #0a6fa0 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(29, 161, 242, 0.4);
            }
            
            #x-list-adder-panel button:active {
                transform: translateY(0);
            }
            
            #x-list-adder-panel button:disabled {
                background: #e1e8ed;
                color: #657786;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }
            
            #x-list-adder-panel button.secondary {
                background: rgba(83, 100, 113, 0.1);
                color: #536471;
                box-shadow: none;
            }
            
            #x-list-adder-panel button.secondary:hover {
                background: rgba(83, 100, 113, 0.15);
                transform: translateY(-1px);
            }
            
            #x-list-adder-panel button.stop {
                background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                color: white;
                box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
            }
            
            #x-list-adder-panel button.stop:hover {
                background: linear-gradient(135deg, #c0392b 0%, #a93226 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
            }
            
            #x-list-adder-status {
                margin-top: 12px;
                font-size: 13px;
                color: #536471;
                padding: 8px 12px;
                background: rgba(29, 161, 242, 0.05);
                border-radius: 8px;
                border-left: 3px solid #1da1f2;
                white-space: pre-line;
                word-wrap: break-word;
                max-height: 120px;
                overflow-y: auto;
            }
            
            #x-list-adder-toggle {
                position: fixed;
                top: 80px;
                right: 20px;
                background: linear-gradient(135deg, #1da1f2 0%, #0d8bd9 100%);
                color: white;
                border: none;
                border-radius: 16px;
                width: 56px;
                height: 56px;
                font-size: 16px;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(29, 161, 242, 0.3);
                z-index: 10001;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            #x-list-adder-toggle:hover {
                transform: translateY(-2px) scale(1.05);
                box-shadow: 0 6px 25px rgba(29, 161, 242, 0.4);
            }
            
            #x-list-adder-toggle:active {
                transform: translateY(0) scale(1);
            }
            
            @media (prefers-color-scheme: dark) {
                #x-list-adder-panel {
                    background: rgba(21, 32, 43, 0.95);
                    border-color: rgba(29, 161, 242, 0.3);
                }
                
                #x-list-adder-panel h3 {
                    color: #ffffff;
                }
                
                #x-list-adder-panel textarea {
                    background: rgba(32, 35, 39, 0.8);
                    border-color: #2f3336;
                    color: #ffffff;
                }
                
                #x-list-adder-panel textarea:focus {
                    border-color: #1da1f2;
                }
                
                #x-list-adder-status {
                    background: rgba(29, 161, 242, 0.1);
                    color: #8b98a5;
                }
            }
        `);

        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.id = 'x-list-adder-toggle';
        toggleButton.innerHTML = '👥+';
        toggleButton.title = 'Add Users to List';

        // Create main panel
        const panel = document.createElement('div');
        panel.id = 'x-list-adder-panel';
        panel.style.display = 'block';

        panel.innerHTML = `
            <h3>Add Users to List</h3>
            <textarea id="x-list-adder-input" placeholder="Enter usernames separated by commas&#10;Example: user1, user2, user3"></textarea>
            <button id="x-list-adder-start">Add Users</button>
            <button id="x-list-adder-stop" class="stop" style="display: none;">Stop</button>
            <button id="x-list-adder-close" class="secondary">Close</button>
            <div id="x-list-adder-status">Ready to add users</div>
        `;

        document.body.appendChild(panel);
        document.body.appendChild(toggleButton);

        // Hide toggle button initially since panel is open
        toggleButton.style.display = 'none';

        return { toggleButton, panel };
    }

    // Initialize the script
    function init() {
        const adder = new ListUserAdder();
        const { toggleButton, panel } = createUI();

        // Event handlers
        toggleButton.addEventListener('click', () => {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            if (isVisible) {
                toggleButton.style.display = 'flex';
            } else {
                toggleButton.style.display = 'none';
            }
        });

        document.getElementById('x-list-adder-close').addEventListener('click', () => {
            panel.style.display = 'none';
            toggleButton.style.display = 'flex';
        });

        document.getElementById('x-list-adder-start').addEventListener('click', async () => {
            const input = document.getElementById('x-list-adder-input');
            const users = input.value.trim().split(',').map(u => u.trim()).filter(u => u);

            if (users.length === 0) {
                alert('Please enter at least one username');
                return;
            }

            await adder.addUsers(users);
        });

        document.getElementById('x-list-adder-stop').addEventListener('click', () => {
            adder.stop();
        });
    }

    // Wait for page to load and initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();