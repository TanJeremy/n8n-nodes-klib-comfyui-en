# n8n-nodes-klib-comfyui

This is a ComfyUI node collection for n8n that allows you to interact with ComfyUI servers in n8n workflows.

## Features

This node package provides the following functionality:

1. **ComfyUI Trigger**: Listen to ComfyUI WebSocket events and trigger workflows when specific events occur
4. **ComfyUI Model Management**: Get available models, samplers, schedulers, and other resource lists
7. **ComfyUI System Control**: Manage queues, interrupt execution, clear history records, etc.

## Installation

1. Navigate to n8n custom nodes directory
```bash
cd ~/.n8n/custom
```

2. Clone this repository
```bash
git clone https://github.com/yorkane/n8n-nodes-klib-comfyui.git
```

3. Install dependencies
```bash
cd n8n-nodes-klib-comfyui
pnpm install
```

4. Build the nodes
```bash
pnpm run build
```

## Publishing to npm

1. Make sure you have an npm account and are logged in
```bash
npm login
```

2. Update the version in package.json if needed
```bash
npm version patch  # or minor, or major
```

3. Build the package
```bash
pnpm run build
```

4. Publish to npm
```bash
npm publish --tag latest
```

Note: Make sure you have the correct npm registry configured and have the necessary permissions to publish the package.

```
rm -rf dist && pnpm build && docker restart n8n && npm publish --tag latest
```
## Node Descriptions

### ComfyUI Trigger

Listen to ComfyUI execution status and image data through WebSocket.
**Operations**:
- Listen to execution status: Listen to execution status of specific prompt IDs
- Listen to image data: Listen and receive image data

### ComfyUI Model Management

Get available models and resources on the ComfyUI server.
**Operations**:
- Get all models: Get a list of all available models
- Get specific type models: Get a list of models of specific types
- Get sampler list: Get a list of available samplers
- Get scheduler list: Get a list of available schedulers
- Get extension list: Get a list of installed extensions
- Get embedding list: Get a list of available embeddings

### ComfyUI System Control

Manage ComfyUI system and queue.
**Operations**:
- Get queue status: Get current queue status
- Clear queue: Clear all tasks in the current queue
- Interrupt execution: Interrupt currently executing tasks
- Clear history: Clear all history records
- Delete history item: Delete specific history record items
- Get system information: Get system information

## Usage Examples

### Example 3: Automated Model Management

1. Use ComfyUI Model Management node to get current available model list
2. Use Function node to check if models need to be updated
3. If update is needed, use HTTP Request node to download new models
