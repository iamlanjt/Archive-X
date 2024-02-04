# archive-x

## What is Archive-X?
Archive-X is a minimal (only 1-package repo) archive bot written in TypeScript, used for automatically archiving the contents of a Discord channel into text files and media. See **Discord TOS Warning** before you attempt to use this program.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

# Discord TOS Warning
This project contains code that, if ran, will put your provided token and associated account in violation of Discord's Terms of Service and Guidelines. This github repository is for educational purposes only. Repository owner is not responsible for any damages to accounts.

# How to use
1) Get your **user token** (not bot)
2) Create `.env` directory
```env
TOKEN="<yourTokenHereWithoutBrackets>
```
3) Configure settings from `index.ts`
4) Run with `bun run index.ts`
5) Type `!archive` in the channel and guild you wish to archive __on the account which you configured as the authorized user account in `index.ts`__
6) Keep an eye on your console, and when finished, check ./outputFiles/`guildName`-`channelName` for your archive.

Please open an issue in this repository if you come across any bugs or have suggestions.