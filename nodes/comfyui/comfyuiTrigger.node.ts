/// <reference lib="dom" />
import type {
	ITriggerFunctions,
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';

export class comfyuiTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ComfyUI Trigger',
		name: 'comfyUiTrigger',
		icon: 'file:comfyui.svg',
		group: ['trigger'],
		version: 1,
		description: 'Trigger for listening to ComfyUI WebSocket events',
		defaults: {
			name: 'ComfyUI Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'httpHeaderAuth',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'ComfyUI Server Address',
				name: 'serverUrl',
				type: 'string',
				default: 'ws://127.0.0.1:8188',
				description: 'ComfyUI server address (e.g., ws://localhost:8188 or wss://example.com), no need to include /ws path',
				placeholder: 'ws://127.0.0.1:8188',
				required: true,
			},
			{
				displayName: 'Manually Specify Header Key',
				name: 'manualHeaderKey',
				type: 'string',
				default: '',
				description: 'Optional: Manually enter the authentication Header Key (e.g., Authorization). If filled, it will override the Header Key in credentials.',
				required: false,
			},
			{
				displayName: 'Manually Specify Header Value',
				name: 'manualHeaderValue',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description: 'Optional: Manually enter the authentication Header Value. If filled, it will override the Header Value in credentials.',
				required: false,
			},
			{
				displayName: 'Event Type Selection Method',
				name: 'eventTypeChoice',
				type: 'options',
				options: [
					{
						name: 'Predefined Events',
						value: 'predefined',
					},
					{
						name: 'Custom Events',
						value: 'custom',
					},
				],
				default: 'predefined',
				description: 'Choose whether to use predefined event types or custom event types',
				required: true,
			},
			{
				displayName: 'Predefined Event Type',
				name: 'predefinedEventType',
				type: 'options',
				options: [
					{
						name: 'ky_monitor',
						value: 'ky_monitor.queue',
						description: 'Triggered when workflow execution starts',
					},
					{
						name: 'Status Update',
						value: 'status',
						description: 'Triggered when status updates',
					},
					{
						name: 'All Events',
						value: 'all',
						description: 'Listen to all event types',
					},
				],
				default: 'ky_monitor.queue',
				description: 'ComfyUI event type to listen to',
				displayOptions: {
					show: {
						eventTypeChoice: ['predefined'],
					},
				},
				required: true,
			},
			{
				displayName: 'Custom Event Type',
				name: 'customEventType',
				type: 'string',
				default: '',
				description: 'Enter the custom event type to listen to',
				placeholder: 'e.g.: custom.event',
				displayOptions: {
					show: {
						eventTypeChoice: ['custom'],
					},
				},
				required: true,
			},
			{
				displayName: 'Reconnection Interval (seconds)',
				name: 'reconnectInterval',
				type: 'number',
				default: 5,
				description: 'How many seconds to wait before attempting to reconnect after disconnection',
				required: false,
			},
			{
				displayName: 'Maximum Retry Count',
				name: 'maxRetries',
				type: 'number',
				default: -1,
				description: 'Maximum retry count, -1 means unlimited retries',
				required: false,
			},
			{
				displayName: 'Instance ID',
				name: 'instanceId',
				type: 'string',
				default: '',
				description: 'Optional: Specify an ID for the trigger instance, which will be appended to the output results.',
				required: false,
			},
			{
				displayName: 'Enable Heartbeat Keep-Alive',
				name: 'enableHeartbeat',
				type: 'boolean',
				default: true,
				description: 'Enable heartbeat mechanism to keep WebSocket connection active and prevent connection timeout',
				required: false,
			},
			{
				displayName: 'Heartbeat Interval (seconds)',
				name: 'heartbeatInterval',
				type: 'number',
				default: 30,
				description: 'Interval time for sending heartbeat messages (seconds)',
				displayOptions: {
					show: {
						enableHeartbeat: [true],
					},
				},
				required: false,
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		// this.logger.info('ComfyUI Trigger execution started');

		// Get server URL from node parameters
		const serverUrl = this.getNodeParameter('serverUrl', '') as string;
		if (!serverUrl) {
			this.logger.error('ComfyUI server address not configured');
			throw new Error('ComfyUI server address is required');
		}

		// Get manual header parameters
		const manualHeaderKey = this.getNodeParameter('manualHeaderKey', '') as string;
		const manualHeaderValue = this.getNodeParameter('manualHeaderValue', '') as string;

		// Get credentials (optional)
		let headerKey = 'Authorization';
		let headerValue = '';
		try {
			const credentials = await this.getCredentials('httpHeaderAuth') as { name?: string; value?: string; } | undefined;
			if (credentials) {
				headerKey = credentials.name || 'Authorization';
				headerValue = credentials.value || '';
			}
		} catch (error) {
			// Credentials are optional, so we can continue without them
			this.logger.debug('Authentication credentials not configured, will not use authentication');
		}

		const eventTypeChoice = this.getNodeParameter('eventTypeChoice', 'predefined') as string;
		const eventType = eventTypeChoice === 'predefined' 
			? this.getNodeParameter('predefinedEventType', '') as string
			: this.getNodeParameter('customEventType', '') as string;
		const reconnectInterval = this.getNodeParameter('reconnectInterval', 5) as number;
		const maxRetries = this.getNodeParameter('maxRetries', -1) as number;
		const instanceId = this.getNodeParameter('instanceId', '') as string;
		const enableHeartbeat = this.getNodeParameter('enableHeartbeat', true) as boolean;
		const heartbeatInterval = this.getNodeParameter('heartbeatInterval', 30) as number;
		const clientId = randomUUID();

		const serverUrlToUse = serverUrl.trim();
		const headerKeyToUse = manualHeaderKey.trim() !== '' ? manualHeaderKey.trim() : headerKey.trim();
		const apiTokenToUse = manualHeaderValue.trim() !== '' ? manualHeaderValue.trim() : headerValue.trim();

		this.logger.debug(`Configuration: serverUrl=${serverUrlToUse}, eventType=${eventType}, clientId=${clientId}, reconnectInterval=${reconnectInterval}, maxRetries=${maxRetries}`);

		let retryCount = 0;
		let ws: WebSocket;
		let isClosing = false;
		let heartbeatTimer: NodeJS.Timeout | null = null;

		const createWebSocketConnection = () => {
			if (isClosing) return;

			try {
				// Parse WebSocket URL
				const parsedUrl = new URL(serverUrlToUse);
				let protocol: string;
				if (parsedUrl.protocol === 'wss:' || parsedUrl.protocol === 'ws:') {
					protocol = parsedUrl.protocol.slice(0, -1); // Remove trailing ':'
				} else {
					protocol = parsedUrl.protocol === 'https:' ? 'wss' : 'ws';
				}
				const wsUrl = `${protocol}://${parsedUrl.host}/ws?clientId=${clientId}`;
				// this.logger.info(`WebSocket URL: ${wsUrl}`);
				
				const authHeaders: { [key: string]: string } = {};
				if (apiTokenToUse) {
					authHeaders[headerKeyToUse.trim()] = apiTokenToUse.trim();
				}

				ws = new WebSocket(wsUrl, {
					headers: authHeaders,
				});

				ws.on('open', () => {
					this.logger.info(`WebSocket connection established: ${wsUrl},headerKeyToUse=${headerKeyToUse},apiTokenToUse=${apiTokenToUse}`);
					retryCount = 0; // Reset retry count
					
					// Start heartbeat mechanism
					if (enableHeartbeat) {
						this.logger.debug(`Starting heartbeat mechanism, interval: ${heartbeatInterval} seconds`);
						heartbeatTimer = setInterval(() => {
							if (ws && ws.readyState === WebSocket.OPEN) {
								try {
									// Send ping message to keep connection active
									ws.ping();
									this.logger.debug('Sent heartbeat ping message');
								} catch (error) {
									this.logger.error('Failed to send heartbeat message', { error });
								}
							} else {
								// Connection closed, clean up heartbeat timer
								if (heartbeatTimer) {
									clearInterval(heartbeatTimer);
									heartbeatTimer = null;
								}
							}
						}, heartbeatInterval * 1000);
					}
				});

				ws.on('message', (data: WebSocket.Data) => {
					try {
						const message = JSON.parse(data.toString());
						const { type, data: eventData } = message;

						// this.logger.debug('Received WebSocket message', { 
						// 	messageType: type,
						// 	messageData: eventData 
						// });

						if (eventType === 'all' || type === eventType) {
							const executionData: INodeExecutionData[][] = [[{
								json: {
									event: type,
									data: eventData,
									timestamp: new Date().toISOString(),
									instance_id: instanceId,
									original_url: serverUrlToUse,
								},
							}]];

							this.emit(executionData);
						}
					} catch (error) {
						this.logger.error('Error processing WebSocket message', { error });
					}
				});

				ws.on('error', (error) => {
					this.logger.error('WebSocket error', { error });
				});

				ws.on('close', () => {
					// this.logger.info('WebSocket connection closed');
					
					// Clean up heartbeat timer
					if (heartbeatTimer) {
						clearInterval(heartbeatTimer);
						heartbeatTimer = null;
						this.logger.debug('Heartbeat timer cleaned up');
					}
					
					if (!isClosing) {
						if (maxRetries === -1 || retryCount < maxRetries) {
							retryCount++;
							this.logger.info(`Attempting to reconnect (attempt ${retryCount})...`);
							setTimeout(createWebSocketConnection, reconnectInterval * 1000);
						} else if (maxRetries !== -1) {
							this.logger.error(`Reached maximum retry count (${maxRetries}), stopping reconnection`);
						}
					}
				});

			} catch (error) {
				this.logger.error(`Error creating WebSocket connection - invalid server URL: ${serverUrlToUse}`, { error });

				if (!isClosing && (maxRetries === -1 || retryCount < maxRetries)) {
					retryCount++;
					this.logger.info(`Attempting to reconnect (attempt ${retryCount}) due to connection creation error...`);
					setTimeout(createWebSocketConnection, reconnectInterval * 1000);
				} else if (!isClosing) {
					this.logger.error(`Reached maximum retry count (${maxRetries}) or retry not allowed, stopping reconnection (connection creation error)`);
				}
			}
		};

		createWebSocketConnection();

		return {
			closeFunction: async () => {
				this.logger.info('Closing WebSocket connection');
				isClosing = true;
				
				// Clean up heartbeat timer
				if (heartbeatTimer) {
					clearInterval(heartbeatTimer);
					heartbeatTimer = null;
					this.logger.debug('Heartbeat timer cleaned up during shutdown');
				}
				
				if (ws && ws.readyState === WebSocket.OPEN) {
					ws.close();
				}
			},
		};
	}
}