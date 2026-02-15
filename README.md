# Scrum Poker App

A real-time networked scrum poker application for agile teams to estimate user stories collaboratively.

## Screenshots

### Card Selection Screen
![Card Selection](https://github.com/user-attachments/assets/362892ea-589f-4550-ba36-05040a7ae207)

### Card Selected State
![Card Selected](https://github.com/user-attachments/assets/8958ed8a-9d15-4065-bec9-b8bca03ffe19)

## Features

- 🃏 **Real-time Collaboration** - Multiple users can join the same room and vote simultaneously
- 📊 **Instant Results** - See statistics (average, median, min, max) when cards are revealed
- 👥 **Observer Mode** - Join as an observer without voting
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile devices
- 🔒 **Room-based Sessions** - Private rooms with unique IDs for team privacy
- ⚡ **WebSocket Communication** - Fast, real-time updates using Socket.IO

## Card Values

Standard Fibonacci sequence for story point estimation:
- 0, ½, 1, 2, 3, 5, 8, 13, 21, 34, 55
- Special cards: ? (unknown), ☕ (need a break)

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
   - Click "Join Room"

2. **Share the Room**
   - Share the Room ID with your team members
   - Use the copy button (📋) for easy sharing

3. **Vote**
   - Select a card that represents your estimate
   - Your vote is hidden from others until revealed
   - A checkmark (✓) shows who has voted

4. **Reveal Cards**
   - When everyone has voted, click "Reveal Cards"
   - All votes are shown simultaneously
   - Statistics are calculated automatically

5. **Start New Round**
   - Click "New Round" to reset all votes
   - Keep the same room and participants

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
