module.exports = function(RED) {
    const { google } = require('googleapis');  // Import the Google APIs library

    // Define the Google Calendar Events Node
    function GoogleCalendarEventsNode(config) {
        RED.nodes.createNode(this, config);  // Create a new Node-RED node
        const node = this;

        // Retrieve the associated Google Calendar configuration node
        node.googleConfig = RED.nodes.getNode(config.google);

        // If Google Calendar config is missing, log an error and stop the process
        if (!node.googleConfig) {
            node.error("Missing Google Calendar configuration");
            return;
        }


        // Helper function to ensure startDate and endDate have time
        function ensureDateTime(dateStr, isEnd) {
            let date = new Date(dateStr);
            
            // Check if dateStr only contains a date (YYYY-MM-DD) and no time part
            if (dateStr.length <= 10) { 
                if (isEnd) {
                    // If it's the end date, append 23:59 for end of day
                    date.setHours(23, 59, 59);
                } else {
                    // If it's the start date, append 00:00 for start of day
                    date.setHours(0, 0, 0);
                }
            }
            // Return the date in ISO 8601 format for the Google Calendar API
            return date.toISOString();
        }
		
        // Input handler with modern Node-RED support for send, done, and error handling
        node.on('input', async function(msg, send, done) {
            try {
                // Prioritize msg.calendar, msg.start, and msg.end, then fallback to config values
                const calendarId = msg.calendar || config.calendar;
                let startDate = msg.start || config.startDate;
                let endDate = msg.end || config.endDate;

                // Check if the calendar ID is specified, if not log an error
                if (!calendarId) {
                    node.error("Calendar ID not specified");
                    return;
                }

                // Check if both startDate and endDate are provided, if not log an error
                if (!startDate || !endDate) {
                    node.error("Start date or end date not specified");
                    return;
                }

                // Ensure startDate and endDate have the proper times
                startDate = ensureDateTime(startDate, false);  // Start date: 00:00 if time is missing
                endDate = ensureDateTime(endDate, true);  // End date: 23:59 if time is missing

                // Convert startDate and endDate to Date objects for comparison
                var startDateObj = new Date(startDate);
                var endDateObj = new Date(endDate);

                // Validate that endDate is greater than startDate, log an error if it isn't
                if (endDateObj <= startDateObj) {
                    node.error("End date must be greater than start date");
                    return;
                }

                // Create a new OAuth2 client using the credentials from the Google configuration node
                const oAuth2Client = new google.auth.OAuth2(
                    node.googleConfig.credentials.clientId,
                    node.googleConfig.credentials.clientSecret,
                    node.googleConfig.redirectUri
                );

                // Set the OAuth2 client credentials (access token and refresh token)
                oAuth2Client.setCredentials({
                    access_token: node.googleConfig.credentials.accessToken,
                    refresh_token: node.googleConfig.credentials.refreshToken
                });

                // Handle token refresh and store the updated tokens
                oAuth2Client.on('tokens', (tokens) => {
                    if (tokens.refresh_token) {
                        node.googleConfig.credentials.refreshToken = tokens.refresh_token;
                    }
                    if (tokens.access_token) {
                        node.googleConfig.credentials.accessToken = tokens.access_token;
                    }
                    // Update the credentials in Node-RED securely
                    RED.nodes.addCredentials(node.googleConfig.id, node.googleConfig.credentials);
                });

                // Create a Google Calendar API client with the OAuth2 client
                const calendarApi = google.calendar({ version: 'v3', auth: oAuth2Client });

                // Call the Google Calendar API to retrieve events for the specified date range
                const res = await calendarApi.events.list({
                    calendarId: calendarId,
                    timeMin: new Date(startDate).toISOString(),
                    timeMax: new Date(endDate).toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime'
                });

                // Set the retrieved events to msg.payload
                msg.payload = res.data.items;

                // Send the message onward with send and indicate successful completion with done
                send(msg);
                done();

            } catch (err) {
                // Handle any errors that occur, log them and send an error status
                done(new Error("Error retrieving events: " + err.message));
                node.status({ fill: "red", shape: "ring", text: "Error: " + err.message });
            }
        });

        // Cleanup when the node is closed
        node.on('close', (removed, done) => {
            // Perform any necessary cleanup here
            if (removed) {
                // If the node is being deleted
            }
            done();  // Signal that cleanup is done
        });
    }

    // Register the node type "google-calendar-events"
    RED.nodes.registerType("google-calendar-events", GoogleCalendarEventsNode);

    // HTTP endpoint to retrieve the list of available calendars, protected by authentication
    RED.httpAdmin.get('/google-calendar/get-calendars', RED.auth.needsPermission('flow.read'), function(req, res) {
        try {
            // Get the configuration node ID from the request
            const configNodeId = req.query.configNodeId;

            // Retrieve the associated configuration node
            const configNode = RED.nodes.getNode(configNodeId);

            // If credentials or the config node are not properly set, return an error
            if (!configNode || !configNode.credentials || !configNode.credentials.accessToken) {
                res.status(500).send("Google Calendar configuration not properly set");
                return;
            }

            // Create an OAuth2 client using the stored credentials
            const oAuth2Client = new google.auth.OAuth2(
                configNode.credentials.clientId,
                configNode.credentials.clientSecret,
                configNode.redirectUri
            );

            // Set the OAuth2 client credentials (access token and refresh token)
            oAuth2Client.setCredentials({
                access_token: configNode.credentials.accessToken,
                refresh_token: configNode.credentials.refreshToken
            });

            // Create a Google Calendar API client
            const calendarApi = google.calendar({ version: 'v3', auth: oAuth2Client });

            // Call the Google Calendar API to list all calendars available to the user
            calendarApi.calendarList.list({}, function(err, response) {
                if (err) {
                    // If an error occurs, send a 500 status and the error message
                    res.status(500).send("Error retrieving calendars: " + err.message);
                } else {
                    // Otherwise, return the list of calendars in JSON format
                    res.json(response.data);
                }
            });
        } catch (err) {
            // Catch any errors and send a 500 status
            res.status(500).send("An error occurred while retrieving calendars: " + err.message);
        }
    });
};
