module.exports = function(RED) {
    const { google } = require('googleapis'); // Import the Google APIs library
    const bodyParser = require('body-parser'); // Middleware to parse incoming request bodies
    const uuid = require('uuid'); // Utility for generating unique identifiers (UUIDs)

    // Temporary storage for authentication sessions
    const authSessions = {};

    // Function to define the Google Calendar config node
    function GoogleCalendarConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.name = config.name; // The name of the node
        node.redirectUri = config.redirectUri; // The redirect URI for OAuth2

        // Credentials are stored securely using Node-RED's credentials system
        node.credentials = this.credentials || {}; // Placeholder for credentials (Client ID, Secret, Tokens)

        // Cleanup when the node is closed
        node.on('close', (removed, done) => {
            // Perform any cleanup actions if needed
            if (removed) {
                // Node is being deleted
            }
            done(); // Signal that cleanup is done
        });
    }

    // Register the custom node type "google-calendar-config"
    RED.nodes.registerType("google-calendar-config", GoogleCalendarConfigNode, {
        credentials: {
            clientId: { type: "text" }, // Store Client ID in plain text
            clientSecret: { type: "password" }, // Store Client Secret as a password (hidden in UI)
            accessToken: { type: "password" }, // Store Access Token as a password (hidden in UI)
            refreshToken: { type: "password" } // Store Refresh Token as a password (hidden in UI)
        }
    });

    // Middleware to add security headers to HTTP responses
    function securityHeaders(req, res, next) {
        res.setHeader("Cache-Control", "no-store"); // Disable caching to prevent sensitive data storage
        res.setHeader("Pragma", "no-cache"); // Disable caching for older browsers
        next(); // Proceed to the next middleware or route handler
    }

    // Add middleware to handle JSON and URL-encoded form bodies for authentication endpoints
    RED.httpAdmin.use('/google-calendar/auth', bodyParser.json());
    RED.httpAdmin.use('/google-calendar/auth', bodyParser.urlencoded({ extended: true }));

    // OAuth2 authentication initiation endpoint, secured with appropriate permissions
    RED.httpAdmin.post('/google-calendar/auth/init', RED.auth.needsPermission('flows.write'), securityHeaders, function(req, res) {
        try {
            const nodeId = req.body.nodeId; // Retrieve node ID from request
            const clientId = req.body.clientId; // Retrieve Client ID from request body
            const clientSecret = req.body.clientSecret; // Retrieve Client Secret from request body

            // Validate that Client ID and Client Secret are provided
            if (!clientId || !clientSecret) {
                res.status(400).send("Client ID and Client Secret are required.");
                return;
            }

            // Retrieve the corresponding node by its ID
            const node = RED.nodes.getNode(nodeId);
            if (!node) {
                res.status(400).send("Node not found. Please deploy your nodes.");
                return;
            }

            // Save the provided credentials in the node
            node.credentials = node.credentials || {};
            node.credentials.clientId = clientId;
            node.credentials.clientSecret = clientSecret;
            RED.nodes.addCredentials(nodeId, node.credentials); // Store the credentials securely

            // Create an OAuth2 client using the provided credentials
            const oAuth2Client = new google.auth.OAuth2(
                clientId,
                clientSecret,
                node.redirectUri // The redirect URI to be used after authentication
            );

            // Generate a unique session ID for CSRF protection during authentication
            const sessionId = uuid.v4();
            authSessions[sessionId] = {
                nodeId: nodeId, // Associate the session ID with the node ID
                timestamp: Date.now() // Track the time the session was created
            };

            // Generate the Google OAuth2 authentication URL
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline', // Request offline access to get a refresh token
                scope: ['https://www.googleapis.com/auth/calendar.readonly'], // Read-only access to the Google Calendar
                state: sessionId, // Include the session ID in the state for CSRF protection
                prompt: 'consent' // Always prompt the user for consent to refresh permissions
            });

            // Send the generated authentication URL back to the client
            res.json({ authUrl: authUrl });
        } catch (err) {
            res.status(500).send("An error occurred during authentication: " + err.message); // Handle errors gracefully
        }
    });

    // OAuth2 callback handler (Google redirects here after authentication), secured with appropriate permissions
    RED.httpAdmin.get('/google-calendar/auth/callback', RED.auth.needsPermission('flows.write'), securityHeaders, function(req, res) {
        const code = req.query.code; // The authorization code returned by Google
        const state = req.query.state; // The state (session ID) passed during the initiation

        // Retrieve the session by its state (session ID)
        const session = authSessions[state];
        if (!session || (Date.now() - session.timestamp) > 600000) { // Check if the session is valid and not expired (10-minute limit)
            res.status(400).send("Invalid or expired session state."); // Session invalid or expired
            return;
        }

        const nodeId = session.nodeId; // Extract the node ID associated with this session
        delete authSessions[state]; // Remove the session after it has been used

        // Retrieve stored credentials for the node
        const credentials = RED.nodes.getCredentials(nodeId);
        if (!credentials) {
            res.status(400).send("Credentials not found. Please re-enter Client ID and Client Secret.");
            return;
        }

        const clientId = credentials.clientId; // Use the stored Client ID
        const clientSecret = credentials.clientSecret; // Use the stored Client Secret

        // Retrieve the node by its ID
        const node = RED.nodes.getNode(nodeId);
        if (!node) {
            res.status(400).send("Node not found. Please deploy your nodes.");
            return;
        }

        // Create a new OAuth2 client using the stored credentials
        const oAuth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            node.redirectUri
        );

        // Exchange the authorization code for an access token and refresh token
        oAuth2Client.getToken(code, function(err, tokens) {
            if (err) {
                res.status(500).send("Error retrieving access token: " + err.message); // Handle token retrieval error
                return;
            }

            // Save the access and refresh tokens in the credentials
            credentials.accessToken = tokens.access_token;
            credentials.refreshToken = tokens.refresh_token;
            RED.nodes.addCredentials(nodeId, credentials); // Store the tokens securely

            // Notify the user that authentication was successful
            res.send("Authentication successful. You can close this window.");
        });
    });
};
