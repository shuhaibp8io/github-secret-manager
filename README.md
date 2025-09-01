# GitHub Secrets & Variables Manager

A modern React frontend application for managing GitHub repository secrets and environment variables with a beautiful UI.

## Features

✨ **Modern Modal UI**: Clean, responsive design with professional modal interface
🔐 **Security**: Token input with show/hide functionality
📊 **Progress Tracking**: Real-time progress bar and status updates in modal
🎯 **Flexible**: Support for both secrets and variables
➕ **Dynamic Management**: Add/remove key-value pairs dynamically
🧹 **Persistence**: Data persists until manually cleared
🚀 **Real-time Feedback**: Detailed success/error messages with progress log
🎨 **Enhanced UX**: Modern modal popup for progress tracking
📋 **Scope Guidance**: Built-in GitHub token scope requirements

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- GitHub Personal Access Token with appropriate permissions

### Installation

1. Clone or navigate to the project directory:
   ```bash
   cd github-secrets-manager
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Required GitHub Token Permissions

Your GitHub Personal Access Token needs the following scopes (the app displays this information):

#### For Repository Secrets & Variables:
- **`repo`** - Full control of private repositories (required for secrets and variables)
- **`public_repo`** - Access public repositories (if working with public repos only)

#### For Organization-level (Optional):
- **`admin:org`** - Required for organization-level secrets and variables

#### Important Notes:
- **Secrets vs Variables**: Both use the same scopes, but secrets require proper encryption
- **Environment Variables**: Require repository access to create/manage environments
- **Public vs Private**: Public repos may only need `public_repo` scope
- **Organizations**: Organization-level management requires additional `admin:org` scope

### Using the Application

1. **Enter your credentials**:
   - Personal Access Token (PAT)
   - Repository Owner (username or organization)
   - Repository Name
   - Environment Name (e.g., production, staging, development)

2. **Choose type**:
   - **Variables**: For non-sensitive configuration data
   - **Secrets**: For sensitive data (passwords, API keys, etc.)

3. **Add key-value pairs**:
   - Click "Add Item" to create new pairs
   - Fill in the key name and value
   - Use the trash icon to remove pairs (minimum 1 required)

4. **Create items**:
   - Click "Create Variables/Secrets" to open the progress modal
   - Watch the real-time progress with modern progress bar
   - View detailed progress log with success/error messages
   - Modal shows live status updates for each operation

5. **Monitor progress**:
   - Progress modal opens automatically when creation starts
   - Real-time progress bar with percentage completion
   - Detailed log shows each step with color-coded results
   - Option to close modal or start new batch when complete

6. **Clear form** (optional):
   - Click "Clear" to reset all fields, results, and close modal

## Modern UI Features

### Professional Modal Interface
- **Progress Modal**: Operations run in a dedicated modal popup
- **Real-time Updates**: Live progress bar with percentage completion
- **Detailed Logging**: Color-coded progress log with success/error/warning messages
- **Clean Design**: Modern gradients, shadows, and smooth animations
- **Responsive**: Works perfectly on desktop and mobile devices

### GitHub Scope Guidance
- **Built-in Help**: Expandable scope requirements section
- **Clear Instructions**: Detailed explanations for each required scope  
- **Context-Sensitive**: Different scopes for different use cases
- **Security Warnings**: Clear notes about proper secret encryption

## How It Works

The application follows GitHub's API workflow:

1. **Repository Validation**: Gets repository ID and validates access
2. **Environment Management**: Checks if environment exists, creates if needed
3. **Item Creation**: Creates each variable/secret individually
4. **Progress Tracking**: Updates progress bar and shows detailed status

### Variables vs Secrets

- **Variables**: Stored as plain text, visible in GitHub UI, good for configuration
- **Secrets**: Encrypted storage using proper libsodium encryption, hidden values, ideal for sensitive data
- **Note**: Secret encryption uses GitHub's required libsodium encryption for production-ready security.

## API Endpoints Used

- `GET /repos/{owner}/{repo}` - Get repository information
- `GET /repos/{owner}/{repo}/environments/{environment}` - Check environment
- `PUT /repos/{owner}/{repo}/environments/{environment}` - Create environment
- `POST /repositories/{repo_id}/environments/{environment}/variables` - Create variables
- `POST /repositories/{repo_id}/environments/{environment}/secrets` - Create secrets
- `GET /repositories/{repo_id}/environments/{environment}/secrets/public-key` - Get encryption key

## Error Handling

The application includes comprehensive error handling:
- Network connectivity issues
- Invalid tokens or insufficient permissions
- Repository or environment access problems
- Individual item creation failures
- Detailed error messages with suggested solutions

## Development

### Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run test suite
- `npm eject` - Eject from Create React App

### Technologies Used

- **React 18** - Frontend framework
- **Axios** - HTTP client for API calls
- **Tailwind CSS** - Utility-first CSS framework
- **Heroicons** - Beautiful SVG icons
- **libsodium-wrappers** - Proper encryption for GitHub secrets
- **GitHub REST API v4** - Backend integration

## Production Considerations

When deploying to production:

1. **Security**:
   - ✅ Proper secret encryption using libsodium (already implemented)
   - Add input validation and sanitization
   - Use environment variables for sensitive configuration
   - Implement rate limiting and CORS policies

2. **Error Handling**:
   - Add retry mechanisms for failed requests
   - Implement better error boundary components
   - Add logging and monitoring

3. **Performance**:
   - Add request debouncing for form inputs
   - Implement caching for repository information
   - Add pagination for large datasets

4. **Accessibility**:
   - Add proper ARIA labels
   - Implement keyboard navigation
   - Test with screen readers

## License

This project is open source and available under the MIT License.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

If you encounter any issues or have questions:
1. Check the GitHub Issues for existing solutions
2. Create a new issue with detailed information
3. Include error messages and steps to reproduce