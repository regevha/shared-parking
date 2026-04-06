# Shared Parking Logs

This directory contains system-wide log files. It is automatically ignored by Git to keep the repository clean.

## Active Log Files
- **parking.log**: Standard out and API request logging for the backend.

## Maintenance
Log rotation is currently handled by the system file handler. In production, consider external log management (e.g., CloudWatch, ELK).
