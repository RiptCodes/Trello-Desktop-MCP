# Trello MCP (RiptCodes fork)

> **This is a fork of [kocakli/Trello-Desktop-MCP](https://github.com/kocakli/Trello-Desktop-MCP)**, MIT licensed, with thanks to its author.
> The fork adds three tools the original could not do: **uploading attachments** and **creating checklists and their items**.
> See [Added in this fork](#added-in-this-fork). Everything else is the original project.

A Model Context Protocol (MCP) server that provides comprehensive Trello integration for any MCP-compatible client — including Claude Desktop, Claude Code, Gemini CLI, and more. This server enables AI assistants to interact with Trello boards, cards, lists, and more through a secure local connection.

## Features

### 🔍 Search & Discovery
- **Universal Search**: Search across all Trello content (boards, cards, members, organizations)
- **User Boards**: Get all boards accessible to the current user
- **Board Details**: Retrieve detailed information about boards including lists and cards

### 📝 Card Management
- **Create Cards**: Add new cards to any list with descriptions, due dates, and assignments
- **Update Cards**: Modify card properties like name, description, due dates, and status
- **Move Cards**: Transfer cards between lists to update workflow status
- **Get Card Details**: Fetch comprehensive card information including members, labels, and checklists

### 💬 Collaboration
- **Add Comments**: Post comments on cards for team communication
- **Member Management**: View board members and member details
- **Activity History**: Track card actions and changes

### 📋 Organization
- **List Management**: Create new lists and get cards within specific lists
- **Labels**: View and manage board labels for categorization
- **Checklists**: Access card checklists and checklist items
- **Attachments**: View card attachments and linked files

## Installation

### Prerequisites
- Node.js 18+ installed
- An MCP-compatible client (Claude Desktop, Claude Code, Gemini CLI, etc.)
- Trello account with API credentials

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/RiptCodes/Trello-Desktop-MCP.git
   cd trello-desktop-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Get Trello API credentials**
   - Visit https://trello.com/app-key
   - Copy your API Key
   - Generate a Token (never expires, read/write access)

5. **Configure your MCP client**

   Choose the instructions for your client below:

   <details>
   <summary><strong>Claude Desktop</strong></summary>

   Edit your Claude Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

   Add the Trello MCP server:
   ```json
   {
     "mcpServers": {
       "trello": {
         "command": "node",
         "args": ["/absolute/path/to/trello-desktop-mcp/dist/index.js"],
         "env": {
           "TRELLO_API_KEY": "your-api-key-here",
           "TRELLO_TOKEN": "your-token-here"
         }
       }
     }
   }
   ```

   Then restart Claude Desktop.
   </details>

   <details>
   <summary><strong>Claude Code (CLI)</strong></summary>

   Add the server using the Claude Code CLI:
   ```bash
   claude mcp add trello -- node /absolute/path/to/trello-desktop-mcp/dist/index.js \
     -e TRELLO_API_KEY=your-api-key-here \
     -e TRELLO_TOKEN=your-token-here
   ```

   Or add it to your project's `.mcp.json`:
   ```json
   {
     "mcpServers": {
       "trello": {
         "command": "node",
         "args": ["/absolute/path/to/trello-desktop-mcp/dist/index.js"],
         "env": {
           "TRELLO_API_KEY": "your-api-key-here",
           "TRELLO_TOKEN": "your-token-here"
         }
       }
     }
   }
   ```
   </details>

   <details>
   <summary><strong>Gemini CLI</strong></summary>

   Edit your Gemini CLI settings file at `~/.gemini/settings.json`:
   ```json
   {
     "mcpServers": {
       "trello": {
         "command": "node",
         "args": ["/absolute/path/to/trello-desktop-mcp/dist/index.js"],
         "env": {
           "TRELLO_API_KEY": "your-api-key-here",
           "TRELLO_TOKEN": "your-token-here"
         }
       }
     }
   }
   ```
   </details>

   <details>
   <summary><strong>Other MCP Clients</strong></summary>

   Any MCP-compatible client that supports stdio transport can use this server. You need to configure it to:
   1. Run `node /absolute/path/to/trello-desktop-mcp/dist/index.js`
   2. Set environment variables `TRELLO_API_KEY` and `TRELLO_TOKEN`

   Refer to your client's documentation for the exact configuration format.
   </details>

6. **Restart your MCP client** to pick up the new configuration.

## Available Tools

The MCP server provides 22 tools: the original 19 in three phases, plus 3 added in this fork.

### Phase 1: Essential Tools
- `trello_search` - Universal search across all Trello content
- `trello_get_user_boards` - Get all boards accessible to the current user
- `get_board_details` - Get detailed board information with lists and cards
- `get_card` - Get comprehensive card details
- `create_card` - Create new cards in any list

### Phase 2: Core Operations
- `update_card` - Update card properties
- `move_card` - Move cards between lists
- `trello_add_comment` - Add comments to cards
- `trello_get_list_cards` - Get all cards in a specific list
- `trello_create_list` - Create new lists on boards

### Phase 3: Advanced Features
- `trello_get_board_cards` - Get all cards from a board with filtering
- `trello_get_card_actions` - Get card activity history
- `trello_get_card_attachments` - Get card attachments
- `trello_get_card_checklists` - Get card checklists
- `trello_get_board_members` - Get board members
- `trello_get_board_labels` - Get board labels
- `trello_get_member` - Get member details

### Added in this fork
- `trello_add_attachment` - Upload a local file (such as a PNG screenshot) to a card with `filePath`, or attach a web link with `url`. `setCover: true` makes an image the card cover. Files up to 10 MB.
- `trello_create_checklist` - Create a checklist on a card. Pass `items` (a list of strings) to add them in the same call, in order.
- `trello_add_checklist_item` - Add one item to an existing checklist, optionally already ticked (`checked: true`).

Examples:
- "Upload C:\shots\desktop.png to the TC Group card and make it the cover"
- "Add a Next steps checklist to that card: send first email, follow up in 5 days"

### Legacy Tools (Backward Compatibility)
- `list_boards` - List user's boards
- `get_lists` - Get lists in a board

## Usage Examples

Once configured, you can use natural language with your AI assistant to interact with Trello:

```
"Show me all my Trello boards"
"Create a new card called 'Update documentation' in the To Do list"
"Move card X from In Progress to Done"
"Add a comment to card Y saying 'This is ready for review'"
"Search for all cards with 'bug' in the title"
"Show me all cards assigned to me"
```

## Architecture

### MCP Protocol
The server implements the Model Context Protocol (MCP), which provides:
- Standardized tool discovery and invocation
- Type-safe parameter validation
- Structured error handling
- Automatic credential management

### Security
- API credentials are stored locally in your MCP client's config
- No credentials are transmitted over the network
- All Trello API calls use HTTPS
- Rate limiting is respected with automatic retry logic

### Technical Stack
- TypeScript for type safety
- MCP SDK for protocol implementation
- Zod for schema validation
- Fetch API for HTTP requests

## Development

### Project Structure
```
├── src/
│   ├── index.ts          # Main MCP server entry point
│   ├── server.ts         # Alternative server implementation
│   ├── tools/            # Tool implementations
│   │   ├── boards.ts     # Board-related tools
│   │   ├── cards.ts      # Card-related tools
│   │   ├── lists.ts      # List-related tools
│   │   ├── members.ts    # Member-related tools
│   │   ├── search.ts     # Search functionality
│   │   ├── advanced.ts   # Advanced features
│   │   └── attachments-checklists.ts  # Fork: uploads and checklists
│   ├── trello/           # Trello API client
│   │   └── client.ts     # API client with retry logic
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── dist/                 # Compiled JavaScript
└── package.json          # Project configuration
```

### Building from Source
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run type checking
npm run type-check
```

### Testing
Unit tests (fake `fetch`, no Trello account needed):
```bash
npm test
```

Live test of the fork's tools against the real Trello API. It makes a throwaway board, runs the tools, checks the card, then deletes the board. Needs `TRELLO_API_KEY` and `TRELLO_TOKEN` in your environment:
```bash
npm run build
node scripts/live-test.mjs
```

You can also test your setup by hand:
1. Checking your MCP client's connection status
2. Running a simple command like "Show me my Trello boards"
3. Verifying the response includes your board data

## Troubleshooting

### Common Issues

1. **"No Trello tools available"**
   - Ensure your MCP client is fully restarted after configuration
   - Check that the path in config points to `dist/index.js`
   - Verify the file exists and is built

2. **"Invalid credentials"**
   - Double-check your API key and token
   - Ensure token has read/write permissions
   - Regenerate token if needed

3. **"Rate limit exceeded"**
   - The server includes automatic retry logic
   - Wait a few minutes if you hit limits
   - Consider reducing request frequency

### Debug Logging
Check your MCP client's logs for connection and error details. For Claude Desktop, logs are at:
- macOS: `~/Library/Logs/Claude/mcp-server-trello.log`
- Windows: `%APPDATA%\Claude\Logs\mcp-server-trello.log`

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/anthropics/mcp)
- Uses the [Trello REST API](https://developer.atlassian.com/cloud/trello/rest/)
- Compatible with [Claude Desktop](https://claude.ai/download), [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Gemini CLI](https://github.com/google-gemini/gemini-cli), and other MCP clients
