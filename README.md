# Item Fulfillment Tracker

A modern web application for tracking item transfers between three parties with QR code authentication and password verification.

## Features

- **Three-Party Transfer System**: Track items from Person A (Sender) → Person B (Intermediary) → Person C (Recipient)
- **QR Code Authentication**: Single-use QR codes for drop-off confirmation
- **Password Protection**: 6-digit PIN authentication for item collection
- **Real-time Status Tracking**: Monitor fulfillment progress through pending, in-transit, and completed stages
- **Timeline Visualization**: See detailed history of each fulfillment stage
- **LocalStorage Persistence**: All data saved locally in browser
- **Dark Theme UI**: Premium design with glassmorphism effects and smooth animations

## Security Features

- **Single-use QR codes**: Prevents unauthorized drop-off confirmations
- **Password authentication**: Verifies Person C is the intended recipient
- **SHA-256 password hashing**: Passwords never stored in plaintext
- **One-time password display**: Password shown only once to Person A
- **Status validation**: Enforces proper workflow sequence

## How It Works

1. **Person A** creates a fulfillment and receives:
   - A 6-digit password (to share with Person C)
   - A QR code (to share with Person B)

2. **Person B** scans the QR code when receiving the item from Person A
   - Status changes to "in-transit"

3. **Person C** collects the item by:
   - Providing the 6-digit password
   - System validates and marks as "completed"

## Installation

No installation required! This is a pure client-side application.

### Running Locally

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/item-fulfillment.git
cd item-fulfillment
```

2. Start a local server:
```bash
python3 -m http.server 8000
```

3. Open your browser to:
```
http://localhost:8000
```

## Usage

### Creating a Fulfillment

1. Click **"New Fulfillment"**
2. Fill in:
   - Item name
   - Person A (Sender)
   - Person B (Intermediary)
   - Person C (Recipient)
3. Copy the password and share with Person C
4. Share QR code with Person B

### Drop-Off (Person B)

1. Click **"Scan QR"** in header
2. Enter the fulfillment code
3. Confirm receipt

### Collection (Person C)

1. Open fulfillment details
2. Click **"Collect Item"**
3. Enter the 6-digit password
4. Verify and collect

## Technology Stack

- **HTML5**: Semantic markup
- **CSS3**: Custom properties, animations, responsive design
- **Vanilla JavaScript**: No frameworks, pure ES6+
- **Web Crypto API**: SHA-256 password hashing
- **QRCode.js**: Client-side QR code generation
- **LocalStorage API**: Data persistence

## File Structure

```
item-fulfillment/
├── index.html          # Main HTML structure
├── index.css           # Styling and design system
├── app.js              # Application logic and state management
└── README.md           # This file
```

## Browser Compatibility

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

Requires support for:
- Web Crypto API
- LocalStorage
- ES6+ JavaScript

## Screenshots

*Coming soon*

## Contributing

This is a personal project, but suggestions and improvements are welcome!

## License

MIT License - feel free to use this code for your own projects.

## Author

Built with ❤️ using modern web technologies

## Acknowledgments

- QRCode.js library for QR code generation
- Inter font family from Google Fonts
