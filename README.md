# MyAI - Your Personal AI Assistant

A fully customizable AI assistant that runs **100% locally** on your PC. No data sent to the cloud. Your privacy, your AI.

## Features

- **100% Local** - Runs on your machine, no cloud dependency
- **Customizable** - Change the AI's personality, name, and behavior
- **Beautiful UI** - Modern dark theme, works on PC and phone
- **Multiple Models** - Use Llama, Mistral, Code Llama, and more
- **Fast** - Real-time responses with streaming support
- **Free** - No subscriptions, no API costs

## Quick Start

### Prerequisites

1. **Python 3.8+** - [Download here](https://www.python.org/downloads/)
2. **Ollama** - [Download here](https://ollama.ai/download)

### Installation

#### Windows
```bash
# Double-click install.bat
# OR run in PowerShell:
.\install.bat
```

#### Mac/Linux
```bash
chmod +x install.sh
./install.sh
```

### Manual Installation

1. **Install Python dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Install Ollama and pull a model:**
   ```bash
   # Install Ollama from https://ollama.ai/download
   ollama pull llama3.2
   ```

3. **Start the server:**
   ```bash
   python backend/server.py
   ```

4. **Open your browser:**
   ```
   http://localhost:5000
   ```

## Usage

### Basic Chat
1. Open `http://localhost:5000` in your browser
2. Type your message in the input box
3. Press Enter or click Send
4. Get instant responses from your AI

### Change AI Model
- Click the model dropdown in the header
- Select from available models (Llama, Mistral, Code Llama, etc.)

### Customize AI Personality
1. Click the **Settings** button (gear icon)
2. Edit the **System Prompt** to change how the AI behaves
3. Change the **AI Name** to whatever you want
4. Click **Save Settings**

### Example System Prompts

**Professional Assistant:**
```
You are a helpful professional assistant. You provide concise, accurate answers.
```

**Coding Expert:**
```
You are an expert programmer. You write clean, efficient code with explanations.
```

**Creative Writer:**
```
You are a creative writer. You help with stories, poems, and creative content.
```

**Research Analyst:**
```
You are a research analyst. You provide detailed analysis with sources.
```

## Available Models

| Model | Size | Best For |
|-------|------|----------|
| llama3.2 | 2GB | General purpose |
| mistral | 4GB | Fast responses |
| codellama | 4GB | Coding tasks |
| phi3 | 2GB | Lightweight |
| llama3.1:8b | 4GB | Balanced |
| llama3.1:70b | 40GB | Best quality (needs 64GB+ RAM) |

To install more models:
```bash
ollama pull <model-name>
```

## Advanced Features

### Custom Prompts File
Edit `prompts/personality.json` to customize the AI:
```json
{
  "system_prompt": "Your custom instructions here",
  "name": "YourAI",
  "personality": "professional"
}
```

### API Endpoints
- `POST /api/chat` - Send a message
- `GET /api/models` - List available models
- `POST /api/model` - Change active model
- `GET /api/prompt` - Get current prompt
- `POST /api/prompt` - Update prompt
- `GET /api/status` - Server status

## Mobile Access

1. Find your PC's IP address:
   ```bash
   ipconfig
   ```
2. On your phone, open: `http://YOUR-PC-IP:5000`
3. Save to home screen for app-like experience

## Troubleshooting

### "Cannot connect to Ollama"
- Make sure Ollama is running: `ollama serve`
- Check if port 11434 is available

### "No models available"
- Pull a model: `ollama pull llama3.2`

### "Server won't start"
- Check if Python is installed: `python --version`
- Install dependencies: `pip install -r backend/requirements.txt`

## Privacy

- **No data leaves your computer**
- **No accounts required**
- **No telemetry**
- **Open source** - inspect the code yourself

## License

MIT License - Use freely, modify as you wish.

## Credits

- [Ollama](https://ollama.ai) - Local AI runtime
- [Llama](https://llama.meta.com) - Meta's AI models
- [Flask](https://flask.palletsprojects.com) - Web framework
