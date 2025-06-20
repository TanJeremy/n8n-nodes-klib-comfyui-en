import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import axios from 'axios';

export class comfyui implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ComfyUI',
		name: 'comfyUi',
		icon: 'file:comfyui.svg',
		group: ['transform'],
		version: 1,
		description: 'Manage ComfyUI model resources and queue',
		defaults: {
			name: 'ComfyUI',
		},
		inputs: [NodeConnectionType.Main],
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
				default: 'http://127.0.0.1:8188',
				description: 'ComfyUI server address (e.g., http://localhost:8188 or https://example.com)',
				placeholder: 'http://127.0.0.1:8188',
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
				displayName: 'Operation Category',
				name: 'operationCategory',
				type: 'options',
				options: [
					{
						name: 'Queue Management',
						value: 'queue',
						description: 'Manage ComfyUI workflow queue',
					},
					{
						name: 'Model Management',
						value: 'models',
						description: 'Get and manage ComfyUI model resources',
					},
				],
				default: 'queue',
				required: true,
				description: 'Operation category to execute',
			},
			// Queue management operations
			{
				displayName: 'Queue Operation',
				name: 'queueOperation',
				type: 'options',
				options: [
					{
						name: 'Get Recent 5 History Records',
						value: 'getRecentHistory',
						description: 'Get recent 5 history records',
					},
					{
						name: 'Get Queue Status',
						value: 'getQueueStatus',
						description: 'Get current queue status',
					},
					{
						name: 'Clear Queue',
						value: 'clearQueue',
						description: 'Clear all tasks in the current queue',
					},
					{
						name: 'Interrupt Current Execution',
						value: 'interruptExecution',
						description: 'Interrupt currently executing tasks',
					},
					{
						name: 'Clear History',
						value: 'clearHistory',
						description: 'Clear history records',
					},
					{
						name: 'Delete History Item',
						value: 'deleteHistoryItem',
						description: 'Delete specific history record items',
					},
					{
						name: 'Get System Information',
						value: 'getSystemInfo',
						description: 'Get ComfyUI system information',
					},
				],
				default: 'getQueueStatus',
				required: true,
				description: 'Queue operation to execute',
				displayOptions: {
					show: {
						operationCategory: ['queue'],
					},
				},
			},
			// Delete history item parameters
			{
				displayName: 'Prompt ID',
				name: 'promptId',
				type: 'string',
				default: '',
				description: 'Prompt ID of the history record item to delete',
				displayOptions: {
					show: {
						operationCategory: ['queue'],
						queueOperation: ['deleteHistoryItem'],
					},
				},
				required: true,
			},
			// Model management operations
			{
				displayName: 'Model Operation',
				name: 'modelsOperation',
				type: 'options',
				options: [
					{
						name: 'Get All Models',
						value: 'getAllModels',
						description: 'Get a list of all available models',
					},
					{
						name: 'Get Specific Type Models',
						value: 'getModelsByType',
						description: 'Get a list of models of specific types',
					},
					{
						name: 'Get Sampler List',
						value: 'getSamplers',
						description: 'Get a list of available samplers',
					},
					{
						name: 'Get Scheduler List',
						value: 'getSchedulers',
						description: 'Get a list of available schedulers',
					},
					{
						name: 'Get Extension List',
						value: 'getExtensions',
						description: 'Get a list of installed extensions',
					},
					{
						name: 'Get Embedding List',
						value: 'getEmbeddings',
						description: 'Get a list of available embeddings',
					},
				],
				default: 'getAllModels',
				required: true,
				description: 'Model operation to execute',
				displayOptions: {
					show: {
						operationCategory: ['models'],
					},
				},
			},
			// Get specific type model parameters
			{
				displayName: 'Model Type',
				name: 'modelType',
				type: 'options',
				options: [
					{
						name: 'Checkpoint Models',
						value: 'checkpoints',
						description: 'Stable Diffusion checkpoint models',
					},
					{
						name: 'VAE',
						value: 'vae',
						description: 'VAE models',
					},
					{
						name: 'LoRA',
						value: 'loras',
						description: 'LoRA models',
					},
					{
						name: 'ControlNet',
						value: 'controlnet',
						description: 'ControlNet models',
					},
					{
						name: 'CLIP',
						value: 'clip',
						description: 'CLIP models',
					},
					{
						name: 'CLIP Vision',
						value: 'clip_vision',
						description: 'CLIP Vision models',
					},
					{
						name: 'Diffusers',
						value: 'diffusers',
						description: 'Diffusers models',
					},
					{
						name: 'Regularization Images',
						value: 'regularization',
						description: 'Regularization images',
					},
					{
						name: 'Upscalers',
						value: 'upscale_models',
						description: 'Image upscaling models',
					},

				],
				default: 'checkpoints',
				description: 'Model type to get',
				displayOptions: {
					show: {
						operationCategory: ['models'],
						modelsOperation: ['getModelsByType'],
					},
				},
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				// Get basic parameters
				let serverUrl = this.getNodeParameter('serverUrl', i) as string;
				// serverUrl needs to remove trailing slashes and everything after, use regex to match
				serverUrl = serverUrl.replace(/\/+$/, '');


				const operationCategory = this.getNodeParameter('operationCategory', i) as string;
				const manualHeaderKey = this.getNodeParameter('manualHeaderKey', i, '') as string;
				const manualHeaderValue = this.getNodeParameter('manualHeaderValue', i, '') as string;

				// Get authentication information
				let headerKey = 'Authorization';
				let headerValue = '';
				try {
					const credentials = await this.getCredentials('httpHeaderAuth') as { name?: string; value?: string; } | undefined;
					if (credentials) {
						headerKey = credentials.name || 'Authorization';
						headerValue = credentials.value || '';
					}
				} catch (error) {
					// Credentials are optional, so we can continue
				}

				// Use manually specified header to override credentials
				const headerKeyToUse = manualHeaderKey.trim() !== '' ? manualHeaderKey.trim() : headerKey.trim();
				const headerValueToUse = manualHeaderValue.trim() !== '' ? manualHeaderValue.trim() : headerValue.trim();

				// Prepare request headers
				const headers: Record<string, string> = {
					'Content-Type': 'application/json',
				};

				if (headerValueToUse) {
					headers[headerKeyToUse] = headerValueToUse;
				}

				// Remove Content-Type header that might cause issues, some GET requests don't need it
				const getHeaders = { ...headers };
				delete getHeaders['Content-Type'];

				// Execute different logic based on operation category
				let responseData;

				if (operationCategory === 'queue') {
					// Queue management operations
					const queueOperation = this.getNodeParameter('queueOperation', i) as string;
					if (queueOperation === 'getRecentHistory') {
						// Get recent 5 history records
						try {
							responseData = (await axios.get(
								`${serverUrl}/history?max_items=5`,
								{ headers: getHeaders, timeout: 10000 }
							)).data;
						} catch (error) {
							// If /history fails, try /api/history
							responseData = (await axios.get(
								`${serverUrl}/api/history`,
								{ headers: getHeaders, timeout: 10000 }
							)).data;
						}
					}

					if (queueOperation === 'getQueueStatus') {
						// Get queue status
						try {
							responseData = (await axios.get(
								`${serverUrl}/queue`,
								{ headers: getHeaders, timeout: 10000 }
							)).data;
						} catch (error) {
							// If /queue fails, try /api/queue
							responseData = (await axios.get(
								`${serverUrl}/api/queue`,
								{ headers: getHeaders, timeout: 10000 }
							)).data;
						}
					} else if (queueOperation === 'clearQueue') {
						// Clear queue
						try {
							await axios.post(
								`${serverUrl}/queue`,
								{ clear: true },
								{ headers, timeout: 10000 }
							);
						} catch (error) {
							// If /queue fails, try /api/queue
							await axios.post(
								`${serverUrl}/api/queue`,
								{ clear: true },
								{ headers, timeout: 10000 }
							);
						}
						responseData = { success: true, message: 'Queue cleared' };
					} else if (queueOperation === 'interruptExecution') {
						// Interrupt current execution
						try {
							await axios.post(
								`${serverUrl}/interrupt`,
								{},
								{ headers, timeout: 10000 }
							);
						} catch (error) {
							// If /interrupt fails, try /api/interrupt
							await axios.post(
								`${serverUrl}/api/interrupt`,
								{},
								{ headers, timeout: 10000 }
							);
						}
						responseData = { success: true, message: 'Current execution interrupted' };
					} else if (queueOperation === 'clearHistory') {
						// Clear history
						try {
							await axios.post(
								`${serverUrl}/history`,
								{ clear: true },
								{ headers, timeout: 10000 }
							);
						} catch (error) {
							// If /history fails, try /api/history
							await axios.post(
								`${serverUrl}/api/history`,
								{ clear: true },
								{ headers, timeout: 10000 }
							);
						}
						responseData = { success: true, message: 'History cleared' };
					} else if (queueOperation === 'deleteHistoryItem') {
						// Delete history item
						const promptId = this.getNodeParameter('promptId', i) as string;
						try {
							await axios.post(
								`${serverUrl}/history`,
								{ delete: [promptId] },
								{ headers, timeout: 10000 }
							);
						} catch (error) {
							// If /history fails, try /api/history
							await axios.post(
								`${serverUrl}/api/history`,
								{ delete: [promptId] },
								{ headers, timeout: 10000 }
							);
						}
						responseData = { success: true, message: `History item ${promptId} deleted` };
					} else if (queueOperation === 'getSystemInfo') {
						// Get system information
						try {
							responseData = (await axios.get(
								`${serverUrl}/system_stats`,
								{ headers: getHeaders, timeout: 10000 }
							)).data;
						} catch (error) {
							// If /system_stats fails, try /api/system_stats
							responseData = (await axios.get(
								`${serverUrl}/api/system_stats`,
								{ headers: getHeaders, timeout: 10000 }
							)).data;
						}
					}
				} else if (operationCategory === 'models') {
					// Model management operations
					const modelsOperation = this.getNodeParameter('modelsOperation', i) as string;

					if (modelsOperation === 'getAllModels') {
						// Get all models
						const response = await axios.get(
							`${serverUrl}/object_info`,
							{ headers: getHeaders }
						);

						responseData = response.data;
					} else if (modelsOperation === 'getModelsByType') {
						// Get specific type models
						const modelType = this.getNodeParameter('modelType', i) as string;

						// Get and filter specific type models
						const allModels = (await axios.get(
							`${serverUrl}/object_info`,
							{ headers: getHeaders }
						)).data;
						const filteredModels: Record<string, any> = {};

						// Check if model type exists
						if (allModels[modelType]) {
							filteredModels[modelType] = allModels[modelType];
						}

						responseData = filteredModels;
					} else if (modelsOperation === 'getSamplers') {
						// Get sampler list
						responseData = (await axios.get(
							`${serverUrl}/samplers`,
							{ headers: getHeaders }
						)).data;
					} else if (modelsOperation === 'getSchedulers') {
						// Get scheduler list
						responseData = (await axios.get(
							`${serverUrl}/schedulers`,
							{ headers: getHeaders }
						)).data;
					} else if (modelsOperation === 'getExtensions') {
						// Get extension list
						responseData = (await axios.get(
							`${serverUrl}/extensions`,
							{ headers: getHeaders }
						)).data;
					} else if (modelsOperation === 'getEmbeddings') {
						// Get embedding list
						responseData = (await axios.get(
							`${serverUrl}/embeddings`,
							{ headers: getHeaders }
						)).data;
					}
				}

				// Return results
				returnData.push({
					json: responseData,
				});
			} catch (error) {
				const suggestion = comfyui.getErrorSuggestion(error);
				const errorInfo = {
					error: error.message,
					status: error.response?.status,
					statusText: error.response?.statusText,
					url: error.config?.url,
					headers: error.config?.headers,
					suggestion: suggestion
				};

				if (this.continueOnFail()) {
					returnData.push({
						json: errorInfo,
					});
				} else {
					// Create more detailed error information
					const detailedError = new Error(
						`ComfyUI API Error (${error.response?.status}): ${error.message}\n` +
						`URL: ${error.config?.url}\n` +
						`Suggestion: ${suggestion}`
					);
					throw detailedError;
				}
			}
		}

		return [returnData];
	}

	/**
	 * Provide solution suggestions based on error type
	 */
	private static getErrorSuggestion(error: any): string {
		const status = error.response?.status;

		switch (status) {
			case 403:
				return '403 Forbidden - Check the following items:\n' +
					'1. Is the ComfyUI server running correctly\n' +
					'2. Is the server URL correct (usually http://127.0.0.1:8188)\n' +
					'3. Check ComfyUI startup parameters to ensure access restrictions are not enabled\n' +
					'4. If using --listen parameter, ensure external access is allowed\n' +
					'5. Check firewall settings';
			case 404:
				return '404 Not Found - API endpoint does not exist, possible reasons:\n' +
					'1. ComfyUI version is too old and does not support this API\n' +
					'2. Incorrect URL path\n' +
					'3. Server configuration issues';
			case 500:
				return '500 Internal Server Error - ComfyUI server internal error:\n' +
					'1. Check ComfyUI server logs\n' +
					'2. Restart ComfyUI server\n' +
					'3. Check server resource usage';
			case undefined:
				if (error.code === 'ECONNREFUSED') {
					return 'Connection refused - ComfyUI server is not running or not accessible:\n' +
						'1. Ensure ComfyUI server is running\n' +
						'2. Check if server address and port are correct\n' +
						'3. Check network connection';
				}
				if (error.code === 'ETIMEDOUT') {
					return 'Request timeout - Server response is slow:\n' +
						'1. Check network connection\n' +
						'2. Increase timeout time\n' +
						'3. Check server load';
				}
				return `Network error (${error.code}): ${error.message}`;
			default:
				return `HTTP ${status} error: ${error.response?.statusText || error.message}`;
		}
	}
}