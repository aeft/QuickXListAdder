# X (Twitter) List Import Script

A simple Tampermonkey script that lets you quickly add multiple X (Twitter) accounts into one of your Lists. It removes the need to manually add each account one by one.

The motivation for this is simple: to learn from experts in your own X (Twitter) lists without being distracted by the platform's recommendation algorithm.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Click the link to install the script: https://github.com/aeft/QuickXListAdder/raw/refs/heads/main/add-to-list.user.js
3. Confirm installation in the Tampermonkey prompt.

## Usage

1. Open the target X (Twitter) List page in your browser. Refresh the page if it doesn't appear.

![1755328860623](./assets/1755328860623.png)

2. Run the script by entering a comma-separated list of usernames, for example:

```text
rustlang,gvanrossum,JeffDean,golang,clattner_llvm,ThePSF,simonw,karpathy
```

![1755370558934](./assets/1755370558934.png)

3. The script will automatically add these accounts to the current List.

![](./assets/20250816_003418.gif)

## How does it work?
The basic idea is to use JavaScript to identify elements on the X (Twitter) page and simulate clicks. If the page changes in the future, this script may stop working. If you have access to ChatGPT / Claude, you can use it to update the script based on the latest version of the page. For example, you can use DevTools Record/Replay (a built-in tool in Chrome) to record the operation flow, export it as JSON, and provide it to ChatGPT—it can help you fix the script to adapt to the updated page.

## How do you start a list when entering a new field?

Use ChatGPT to search and tell you some usernames.
Prompt:

```text
Search and tell me about some famous open-source developers I should follow on X. The last line of your response should include the concise result with X usernames (no @ prefix) separated by commas.
```

Result: https://chatgpt.com/share/68a0d0eb-5ea0-800a-be78-0246a46999ad

## Note

You may encounter the error "You aren't allowed to add this member to this List.
" if add 50 or more (I am not sure the exact number. I tried 24, and it works fine), more details:

- https://www.reddit.com/r/Twitter/comments/17ucr7q/cant_add_more_accounts_to_twitter_lists/
- https://www.reddit.com/r/Twitter/comments/txfaw5/cant_add_people_to_my_list/

## Disclaimer

Use at your own risk. Running automated actions may violate X (Twitter) Terms of Service.

The author is not responsible for any account restrictions that may result.
