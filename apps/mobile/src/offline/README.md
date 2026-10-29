# Offline Photo Queue

Future implementation architecture for daily auto-rickshaw poster photos:
1. When a driver is offline (no network connectivity in remote areas), photos and GPS coordinates are signed with a device key and stored in SQLite / AsyncStorage.
2. A background worker periodically attempts sync when network is restored.
3. Strict replay attack prevention: photo timestamp and hardware EXIF data must match the verification window.
