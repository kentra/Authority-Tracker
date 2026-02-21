# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- **Real-time Synchronization**: Integrated Socket.IO for seamless cross-device state syncing so players can use multiple devices to view and manage scores.
- **Backend API**: Transitioned from a simple static server to a FastAPI backend application to support web sockets and future API endpoints.
- **Rotate Players Submenu**: Added a feature in the menu to rotate individual player scorecards in 90-degree increments to perfectly accommodate any seating arrangement around the device.
- **Custom Player Names**: Implemented a submenu to allow users to override default "Player 1", "Player 2" names.
- **Star Realms Theme & Layout**: Designed a deep space interface tailored for *Star Realms* with faction colors and automated 1-4 player grid layouts.
- **Authority Tracker App**: Core functional components (+1, -1, +5, -5 buttons, animated point differential history).

### Fixed
- **Mobile Fullscreen Issue**: Remedied an issue that caused white bars on the top and bottom of modern mobile devices (like iPhone 14 Pro) by utilizing iOS safe area environments and viewport adjustments.
- **Responsive Layout for Rotation**: Re-engineered tracker layout so cards automatically scale and reshape their aspect ratios correctly when rotated by 90 or 270 degrees.