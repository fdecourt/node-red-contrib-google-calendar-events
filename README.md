# Google Calendar Events Node for Node-RED

This repository provides a custom Node-RED node that allows you to connect to the Google Calendar API, retrieve events, and work with both full-day and timed events. The node offers an intuitive interface for selecting calendars and date ranges, with OAuth2 authentication to securely access your Google Calendar.

---

## Features

- **OAuth2 Authentication:** Secure integration with Google Calendar through OAuth2.
- **Retrieve Events:** Fetch events between specific start and end dates.
- **Full-Day Event Support:** Easily switch between full-day events and events with specific time ranges.
- **Dynamic Calendar List:** Automatically loads available calendars and provides them in a dropdown.
- **Configurable UI in Node-RED:** Easy to configure via the Node-RED editor.

## Prerequisites

Before using this node, ensure you have:

1. A [Google Cloud Project](https://console.cloud.google.com/) with the **Google Calendar API** enabled.
2. OAuth2 credentials (Client ID and Client Secret) created in the Google Cloud Console.
3. Node-RED installed on your system.

---

## Installation

Not ready yes ;-)

## Configuration

### Global Configuration Node: `google-calendar-config`

The `google-calendar-config` node is responsible for handling OAuth2 authentication with Google Calendar. This requires creating a project in the Google Cloud Console and obtaining OAuth2 credentials.

#### Setup Instructions:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new Web App project and enable the **Google Calendar API**.
3. Create OAuth 2.0 credentials by setting up a **Client ID** and **Client Secret**.
4. In the Node-RED editor, the `google-calendar-config` node will generate a redirect URI. Copy this URI and add it to your **Authorized Redirect URIs** in the Google Cloud Console.
5. Use the **Client ID** and **Client Secret** generated in Google Cloud Console and enter them in the `google-calendar-config` node in Node-RED.
6. Click **Authenticate with Google** to start the OAuth2 process. Follow the prompts to authorize your Node-RED instance to access your Google Calendar.

### Event Retrieval Node: `google-calendar-events`

This node retrieves events from your Google Calendar. Configure the following fields:

- **Calendar**: This dropdown will be populated dynamically with your available Google Calendars once authentication is completed.
- **Start Date**: The date and time from which you want to retrieve events.
- **End Date**: The date and time until which you want to retrieve events.
- **Full-Day Events**: If you want to retrieve full-day events, check the box. If unchecked, you will retrieve events within specific time frames.

### Steps to Use:

1. Drag the `google-calendar-events` node into your flow.
2. Configure the node by adding a new Google Calendar Configuration
3. Add the **Client ID** and **Client Secret** from your Google Cloud Console to the node's configuration.
4. Click on **Authenticate with Google** to log in and authorize access to your Google Calendar.
5. Select the calendar and set the date range (start and end dates).
6. Deploy the flow and start retrieving events from your Google Calendar.

## Advanced Configuration
### Dynamic Parameter Override:

You can dynamically override parameters like calendar, start and end, using msg.calendar, msg.start, msg.end.
be aware that the calendar you want to use must be identified by its ID (you can find it when opening the google-calendar-events node)


## Important Notice
### Authentication process with HomeAssistant
If using it with NodeRed as a plugin in HomeAssistant, you may need to reenter yoiur HomeAssistant Login / Password during the authorization process with Google Agenda.

### Nginx Proxy Manager
If using NginxProxyManager (NPM), you may have to configure a specific location, to allow it to work : 

- NODERED_IP : this is the IP address of your NodeRed installation.
- NODERED_PORT : this is the NodeRed port (if using through HomeAssistant, it is **not** the HomeAssistant Port, but the NodeRed one)

This one is working for me :

```
location /google-calendar/ {
    proxy_pass http://NODERED_IP:NODERED_PORT/google-calendar/; 
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```
