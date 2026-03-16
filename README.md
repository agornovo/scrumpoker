# Scrum Poker App

[![CI](https://github.com/agornovo/scrumpoker/actions/workflows/ci.yml/badge.svg)](https://github.com/agornovo/scrumpoker/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/agornovo/scrumpoker/graph/badge.svg)](https://codecov.io/gh/agornovo/scrumpoker)

A real-time networked scrum poker application for agile teams to estimate user stories collaboratively.

## Screenshots

### Welcome Screen (Light Theme)
![Welcome Light Theme](docs/screenshots/welcome-light.png)

### Welcome Screen (Dark Theme)
![Welcome Dark Theme](docs/screenshots/welcome-dark.png)

### Voting Room
![Voting Room](docs/screenshots/voting-room.png)

### Card Selected State
![Card Selected](docs/screenshots/card-selected.png)

### Revealed Results
![Revealed Results](docs/screenshots/revealed-results.png)

### Inactivity Warning Banner
![Inactivity Warning](docs/screenshots/inactivity-warning.png)


- 🃏 **Real-time Collaboration** - Multiple users can join the same room and vote simultaneously
- 🎴 **Playing Card Shape** - Participant cards are proper portrait playing-card proportions (2:3 aspect ratio). The card back shows an intricate navy-blue diamond-lattice pattern with ornate inner frame; only the vote value appears on the face — no other info inside the card
- 🔄 **3-D Card Flip on Reveal** - Cards smoothly flip with a staggered CSS 3-D rotation when the host reveals votes, back-to-front one by one
- 📊 **Instant Results** - See statistics (average, median, min, max) when cards are revealed
- 🎴 **Multiple Card Sets** - Choose from Standard [1-100], Fibonacci, T-Shirt Sizes, or Powers of 2
- 👥 **Observer Mode** - Join as an observer without voting; observers appear in a compact strip below the voter cards (not as a playing card), keeping the card grid clean
- 🌓 **Theme Toggle** - Switch between light and dark themes (saved per browser)
- 🎨 **Color Palettes** - 8 built-in color palettes (Ocean, Forest, Sunset, Violet, Rose, Teal, Crimson, Slate)
- 📝 **Story Title** - Host can label each round with a story title or ticket number
- ⚡ **Auto-reveal** - Optionally reveal cards automatically once every voter has voted
- 🎉 **Special Effects** - Optional casino poker table visual (green felt surface with dark wood rail and card-suit decorations) throughout the voting session when dark theme is active, plus confetti, fireworks, and sound effects when the team reaches consensus
- 📜 **Round History** - Session log of past rounds shown after each reveal
- 🔗 **Shareable URL** - Room link auto-updates with `?room=` so you can share it directly from the address bar
- 📘 **Estimation Help Section** - In-app guidance on usage, Fibonacci sizing, and story points
- 👑 **Host Controls** - Room creator can reveal/reset rounds and remove participants
- 🔄 **Reconnect Grace Period** - Page refreshes preserve your vote and room membership
- 🏠 **Host Takeover** - If the host is absent for over a minute, remaining participants are offered the option to become the new host
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile devices
- 🔒 **Room-based Sessions** - Private rooms with unique IDs for team privacy
- ⏱️ **Inactivity Auto-Cleanup** - Rooms that have been idle for 15 minutes receive an in-room warning; if no activity resumes within 5 minutes the room is automatically closed and all resources freed (prevents memory leaks on long-running servers)
- 🔌 **WebSocket Communication** - Fast, real-time updates using Socket.IO

## Card Values

Choose from four card sets when creating a room:

| Card Set | Values |
|---|---|
| **Standard** *(default)* | 1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕ |
| **Fibonacci** | 0, ½, 1, 2, 3, 5, 8, 13, 21, 34, 55, ?, ☕ |
| **T-Shirt Sizes** | XS, S, M, L, XL, XXL, ?, ☕ |
| **Powers of 2** | 1, 2, 4, 8, 16, 32, 64, ?, ☕ |

The card set is chosen by the room creator at join time and applies to all participants in the room.

## Local Development

### Prerequisites

- Node.js 18 or higher
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

Unit tests achieve **100% code coverage** (statements, branches, functions, and lines) enforced via Jest thresholds. Coverage is reported to [Codecov](https://codecov.io/gh/agornovo/scrumpoker) on every CI run, and a coverage diff comment is posted to each pull request automatically.

Unit tests cover:
- Health check endpoints
- Room management (create, join, cleanup)
- Voting functionality
- Real-time statistics calculation
- Vote reveal and reset operations
- Multi-user collaboration
- Observer mode
- Card set selection and room-level broadcasting
- **Stress test** – 30 concurrent rooms with 8 voters each completing a full vote-and-reveal cycle (240 simultaneous Socket.IO connections)

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

The project uses GitHub Actions for CI/CD. Two parallel jobs run on every push and pull request:

**`test` job** (Node.js matrix: 18.x, 20.x, 24.x)
- Unit tests with 100% code coverage (statements, branches, functions, and lines) enforced via Jest thresholds
- E2E tests with Playwright against `node server.js`
- Coverage report uploaded to [Codecov](https://codecov.io/gh/agornovo/scrumpoker) on every push and pull request (Node 20.x run), showing a coverage badge and a per-PR diff comment

**`docker-e2e` job**
- Builds the production Docker image
- Starts the container with short reconnect timeouts for test speed
- Runs the full Playwright E2E test suite against the running Docker container
- Uploads the Playwright HTML report as a CI artifact

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
   - Optionally enable **Special Effects** (casino poker table visual in dark theme throughout the session, plus confetti, fireworks, and sounds on consensus) — applies when creating a new room
   - Click "Join Room"

2. **Share the Room**
   - Share the Room ID with your team members
   - Use the copy button (📋) for easy sharing
   - Use the link button (🔗) to copy a direct shareable URL

3. **Set the Story (Host only)**
   - Type a story title or ticket number in the **Current Story** field
   - The title is broadcast to all participants in real time

4. **Vote**
   - Select a card that represents your estimate
   - Your vote is hidden from others until revealed
   - A checkmark (✓) shows who has voted
   - Enable **Auto-reveal** to automatically reveal when every voter has voted

5. **Reveal Cards**
   - The room host clicks "Reveal Cards" after everyone has voted
   - All votes are shown simultaneously
   - Statistics (average, median, min, max) are calculated automatically

6. **Start New Round**
   - The room host clicks "New Round" to reset all votes
   - The completed round is added to the **Round History**
   - Keep the same room and participants

7. **Use Estimation Guidance**
   - Open the help section on the welcome screen
   - Review guidance on Scrum Poker purpose, Fibonacci sizing, and story points

8. **Personalize the UI**
   - Switch between **Light** and **Dark** themes
   - Choose one of 8 **Color Palettes** (Ocean, Forest, Sunset, Violet, Rose, Teal, Crimson, Slate)

## Architecture

- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Communication**: WebSocket for real-time updates
- **Deployment**: Docker + OpenShift compatible

## Configuration

The app uses environment variables for configuration:

- `PORT` - Server port (default: `8080`)
- `RECONNECT_GRACE_PERIOD_MS` - Time (ms) a disconnected user has to reconnect before being removed (default: `8000`)
- `HOST_TAKEOVER_TIMEOUT_MS` - Time (ms) after the host disconnects before other participants can take over (default: `60000`)
- `INACTIVITY_WARNING_MS` - Time (ms) of room inactivity before a warning banner is shown to participants (default: `900000` = 15 minutes). Set to `0` to disable the inactivity warning and auto-close feature entirely.
- `INACTIVITY_CLOSE_DELAY_MS` - Time (ms) after the inactivity warning before the room is automatically closed (default: `300000` = 5 minutes)
- `CORS_ORIGIN` - CORS origin for Socket.IO (default: `*`)

## License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
