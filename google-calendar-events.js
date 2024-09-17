module.exports = function(RED) {
    const { google } = require('googleapis');

    function GoogleCalendarEventsNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.googleConfig = RED.nodes.getNode(config.google);

        if (!node.googleConfig) {
            node.error("Missing Google Calendar configuration");
            return;
        }

        node.on('input', async function(msg) {
            try {
                var calendarId = config.calendar || msg.calendar;
                var startDate = config.startDate || msg.start;
                var endDate = config.endDate || msg.end;

                if (!calendarId) {
                    node.error("Calendar ID not specified");
                    return;
                }
                if (!startDate || !endDate) {
                    node.error("Start date or end date not specified");
                    return;
                }
				
				// Convert startDate and endDate to Date objects for comparison
				var startDateObj = new Date(startDate);
				var endDateObj = new Date(endDate);

				// Validate that endDate is greater than startDate
				if (endDateObj <= startDateObj) {
					node.error("End date must be greater than start date");
					return;
				}

                var oAuth2Client = new google.auth.OAuth2(
                    node.googleConfig.credentials.clientId,
                    node.googleConfig.credentials.clientSecret,
                    node.googleConfig.redirectUri
                );

                oAuth2Client.setCredentials({
                    access_token: node.googleConfig.credentials.accessToken,
                    refresh_token: node.googleConfig.credentials.refreshToken
                });

                // Gestion du rafraîchissement des tokens
                oAuth2Client.on('tokens', (tokens) => {
                    if (tokens.refresh_token) {
                        node.googleConfig.credentials.refreshToken = tokens.refresh_token;
                    }
                    if (tokens.access_token) {
                        node.googleConfig.credentials.accessToken = tokens.access_token;
                    }
                    RED.nodes.addCredentials(node.googleConfig.id, node.googleConfig.credentials);
                });

                const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

                const res = await calendar.events.list({
                    calendarId: calendarId,
                    timeMin: new Date(startDate).toISOString(),
                    timeMax: new Date(endDate).toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime'
                });

                msg.payload = res.data.items;
                node.send(msg);

            } catch (err) {
                node.error("Error retrieving events: " + err.message);
				node.status({ fill: "red", shape: "ring", text: "Error: " + err.message });
            }
        });
    }
    RED.nodes.registerType("google-calendar-events", GoogleCalendarEventsNode);

    // Endpoint pour récupérer la liste des calendriers
    RED.httpAdmin.get('/google-calendar/get-calendars', function(req, res) {
        try {
            var configNodeId = req.query.configNodeId;
            var configNode = RED.nodes.getNode(configNodeId);

            if (!configNode || !configNode.credentials || !configNode.credentials.accessToken) {
                res.status(500).send("Google Calendar configuration not properly set");
                return;
            }

            var oAuth2Client = new google.auth.OAuth2(
                configNode.credentials.clientId,
                configNode.credentials.clientSecret,
                configNode.redirectUri
            );

            oAuth2Client.setCredentials({
                access_token: configNode.credentials.accessToken,
                refresh_token: configNode.credentials.refreshToken
            });

            const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

            calendar.calendarList.list({}, function(err, response) {
                if (err) {
                    res.status(500).send("Error retrieving calendars: " + err.message);
                } else {
                    res.json(response.data);
                }
            });
        } catch (err) {
            res.status(500).send("An error occurred while retrieving calendars." + err.message);
        }
    });
};
