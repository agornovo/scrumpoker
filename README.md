# Scrum Poker App

A real-time networked scrum poker application for agile teams to estimate user stories collaboratively.

## Screenshots

### Welcome Screen (Light Theme)
![Welcome Light Theme](https://github.com/user-attachments/assets/7080d881-bdcc-41e9-9cb2-719cddcb4e74)

### Welcome Screen (Dark Theme)
![Welcome Dark Theme](https://github.com/user-attachments/assets/e6fb3825-73d8-4d3f-bb3c-01e32d339f92)

### Voting Room
![Voting Room](https://github.com/user-attachments/assets/cc9ef640-86ad-42a6-8d32-b5327f3181a5)

### Card Selected State
![Card Selected](https://github.com/user-attachments/assets/42da6754-de28-40ae-a093-fff2daac7c25)

### Revealed Results
![Revealed Results](https://github.com/user-attachments/assets/8117ecda-cffa-463a-8eaf-0c7bbab0a8ab)

## Features

- 🃏 **Real-time Collaboration** - Multiple users can join the same room and vote simultaneously
- 📊 **Instant Results** - See statistics (average, median, min, max) when cards are revealed
- 🎴 **Multiple Card Sets** - Choose from Standard [1-100], Fibonacci, T-Shirt Sizes, or Powers of 2
- 👥 **Observer Mode** - Join as an observer without voting
- 🌓 **Theme Toggle** - Switch between light and dark themes (saved per browser)
- 📘 **Estimation Help Section** - In-app guidance on usage, Fibonacci sizing, and story points
- 👑 **Host Controls** - Room creator can reveal/reset rounds and remove participants
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile devices
- 🔒 **Room-based Sessions** - Private rooms with unique IDs for team privacy
- ⚡ **WebSocket Communication** - Fast, real-time updates using Socket.IO

## Card Values

Choose from four card sets when creating a room:

| Card Set | Values |
|---|---|
| **Standard** *(default)* | 1, 2, 3, 5, 8, 13, 20, 40, 100, ? |
| **Fibonacci** | 0, ½, 1, 2, 3, 5, 8, 13, 21, 34, 55, ?, ☕ |
| **T-Shirt Sizes** | XS, S, M, L, XL, XXL, ? |
| **Powers of 2** | 1, 2, 4, 8, 16, 32, 64, ? |

The card set is chosen by the room creator at join time and applies to all participants in the room.

## Local Development

### Prerequisites

- Node.js 14 or higher
- npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/agornovo/scrumpoker.git
cd scrumpoker
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:8080
```

## Testing

The project includes comprehensive test coverage with both unit tests and end-to-end tests.

### Running Tests

Run all tests (unit + E2E):
```bash
npm test
```

Run only unit tests:
```bash
npm run test:unit
```

Run only E2E tests:
```bash
npm run test:e2e
```

Run unit tests in watch mode (for development):
```bash
npm run test:unit:watch
```

Run E2E tests with UI (for debugging):
```bash
npm run test:e2e:ui
```

Run E2E tests in headed mode (see the browser):
```bash
npm run test:e2e:headed
```

### Test Coverage

Unit tests cover:
- Health check endpoints
- Room management (create, join, cleanup)
- Voting functionality
- Real-time statistics calculation
- Vote reveal and reset operations
- Multi-user collaboration
- Observer mode
- Card set selection and room-level broadcasting

E2E tests cover:
- Joining rooms and user authentication
- Card set selection (Standard, Fibonacci, T-Shirt, Powers of 2)
- Card selection and deselection
- Voting workflow
- Real-time updates across multiple users
- Reveal cards and statistics display
- New round/reset functionality
- Observer mode behavior
- Copy room ID functionality
- Room creator card set shared with all participants

### Continuous Integration

The project uses GitHub Actions for CI/CD. The workflow runs:
- Unit tests with coverage reporting
- E2E tests with Playwright
- Tests on Node.js 18.x and 20.x

CI runs automatically on:
- Push to main/master branches
- Pull requests to main/master branches

## Deployment

### Docker

Build the Docker image:
```bash
docker build -t scrumpoker .
```

Run the container:
```bash
docker run -p 8080:8080 scrumpoker
```

### OpenShift

Deploy to OpenShift using the provided configuration:

```bash
# Build and push your image to a registry accessible by OpenShift
docker build -t your-registry/scrumpoker:latest .
docker push your-registry/scrumpoker:latest

# Update the image in openshift-deployment.yaml, then apply:
oc apply -f openshift-deployment.yaml
```

The deployment includes:
- Health check endpoints (`/health` and `/ready`)
- Automatic TLS/HTTPS termination
- Liveness and readiness probes
- Service and Route configuration

## How to Use

1. **Create or Join a Room**
   - Enter your name
   - Either enter an existing Room ID or leave blank to create a new one
   - Optionally check "Join as Observer" to watch without voting
   - Select a **Card Set** (Standard, Fibonacci, T-Shirt Sizes, or Powers of 2) — applies when creating a new room
   - Click "Join Room"

2. **Share the Room**
   - Share the Room ID with your team members
   - Use the copy button (📋) for easy sharing

3. **Vote**
   - Select a card that represents your estimate
   - Your vote is hidden from others until revealed
   - A checkmark (✓) shows who has voted

4. **Reveal Cards**
   - The room host clicks "Reveal Cards" after everyone has voted
   - All votes are shown simultaneously
   - Statistics are calculated automatically

5. **Start New Round**
   - The room host clicks "New Round" to reset all votes
   - Keep the same room and participants

6. **Use Estimation Guidance**
   - Open the help section on the welcome screen
   - Review guidance on Scrum Poker purpose, Fibonacci sizing, and story points

## Architecture

- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Communication**: WebSocket for real-time updates
- **Deployment**: Docker + OpenShift compatible

## Configuration

The app uses environment variables for configuration:

- `PORT` - Server port (default: 8080)

## License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
