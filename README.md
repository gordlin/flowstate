# 🌊 FlowState

> AI-powered web accessibility assistant that detects user struggles and provides personalized, simplified content summaries.

FlowState is a Chrome extension designed to help neurodivergent users, elderly people, and anyone who finds complex web content overwhelming. It uses behavioral AI to detect when you're struggling with a page and offers context-aware assistance.

## ✨ Features

### 🧠 Intelligent Behavior Detection
- **Passive Monitoring**: Tracks scroll patterns, dwells, text selections, and clicks without intrusion
- **Smart Classification**: AI classifier detects struggling users based on behavioral signals
  - Scroll reversals (going back to re-read)
  - Long dwells (stuck on content)
  - Text highlighting (trying to focus)
  - Rage clicks and dead clicks
- **Personalized Triggers**: Only offers help when you actually need it

### 🤖 Multi-Agent AI System
FlowState uses a sophisticated multi-agent pipeline to transform complex content:

1. **Navigator**: Analyzes page structure and identifies key actions
2. **Security Sentinel**: Detects dark patterns, hidden fees, and risky actions
3. **Compassionate Writer**: Creates warm, simple summaries (5th-6th grade level)
4. **Technical Writer**: Produces direct, efficient summaries with specifics
5. **Arbiter**: Merges both approaches for the best result
6. **Guardian**: Quality-checks output before delivery

### 📝 Content Transformation
- **Simplified Language**: Complex jargon explained in plain terms
- **Structured Summaries**: Key points, warnings, and actions clearly highlighted
- **Legal Translation**: Fine print converted to understandable language
- **Security Alerts**: Warnings about suspicious patterns or risky actions
- **Custom Prompts**: AI adapts to your specific struggles (e.g., "user highlighted medical terms")

### ♿ Accessibility Features
- **Dyslexia-Friendly Font**: Optional Lexend font with optimized spacing
- **Resizable Sidebar**: Drag to adjust width (300px - 800px)
- **Clean Interface**: Isolated iframe prevents style conflicts
- **Keyboard Friendly**: All actions accessible via keyboard

### 📊 Adaptive Learning System
FlowState learns your reading patterns over time and personalizes summaries accordingly:

**User Metrics Tracked:**
| Metric | What It Measures | How It Affects Summaries |
|--------|------------------|--------------------------|
| **Attentiveness** | Focus ability (dwell patterns) | Short attention → shorter paragraphs, more headers |
| **Reading Speed** | Content processing speed | Slow → simpler sentences; Fast → executive summaries |
| **Comprehension** | Understanding level (reversals) | Low → define all terms, use analogies |
| **Patience** | Detail tolerance (frustration) | Low → TL;DR style; High → full context |
| **Technical Familiarity** | Comfort with jargon | Low → plain language; High → standard terminology |

**How It Works:**
1. **Baseline**: All metrics start at 0.5 (neutral)
2. **Learning**: Each session updates metrics based on behavior
3. **Convergence**: After ~20 sessions, profile stabilizes (learning rate decreases)
4. **Personalization**: LLMs receive your profile and adapt their writing style

**Example:**
```
User with low attention (0.33) + low patience (0.28):
→ "Use very short paragraphs, bullet points only, skip background info,
   get to the action items immediately"

User with high comprehension (0.82) + high patience (0.75):
→ "Can handle nuanced explanations, include context and background,
   use standard terminology without excessive simplification"
```

## 🚀 Installation

### From Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/flowstate.git
   cd flowstate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add your OpenRouter API key**

   Edit `src/agents/llm.ts` and replace the placeholder API key:
   ```typescript
   const devKey = 'your-openrouter-api-key-here';
   ```

   Or configure it in the extension after installation.

4. **Build the extension**
   ```bash
   npm run build
   ```

5. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## 📖 Usage

### Basic Workflow

1. **Browse Normally**: FlowState passively monitors your behavior
2. **Automatic Detection**: After 15 seconds, AI analyzes your interactions
3. **Help Popup**: If you're struggling, a friendly popup appears:
   - "Having trouble with this section? Let me simplify it."
4. **Accept Help**: Click to open the sidebar with AI-generated summary
5. **Review Summary**: See simplified content, security warnings, and key actions

### Manual Activation

Click the floating 🌊 button (bottom-right) to manually open the sidebar anytime.

### Settings

- **Reading-Optimized Font**: Toggle Lexend font for easier reading
- **Sidebar Width**: Drag the left edge to resize (300-800px)

## 🏗️ Architecture

### Project Structure

```
flowstate/
├── src/
│   ├── agents/          # Multi-agent AI system
│   │   ├── agents.ts    # Agent implementations
│   │   ├── classifier.ts # Behavior classifier
│   │   ├── graph.ts     # Agent orchestration
│   │   ├── llm.ts       # OpenRouter API client
│   │   ├── orchestrator.ts # State management
│   │   ├── prompts.ts   # All LLM prompts
│   │   └── types.ts     # TypeScript types
│   ├── content.ts       # Main content script
│   ├── popup.ts         # Help popup UI
│   ├── tracker.ts       # Behavior tracking
│   ├── parse.ts         # Content parsing
│   └── background.ts    # Service worker
├── web/                 # Landing page
├── dist/                # Built extension
└── manifest.json        # Chrome extension manifest
```

### Technology Stack

- **Framework**: TypeScript + Vite
- **AI**: OpenRouter API (supports multiple LLM providers)
  - Classifier: Google Gemini 2.0 Flash
  - Agents: Configurable per-agent models
- **Parsing**: Mozilla Readability
- **UI**: Vanilla TypeScript (iframe isolation)

### Data Flow

```
User Behavior → Tracker → Event Log
                              ↓
                     Classifier Agent (LLM)
                              ↓
                   Need Help? + Custom Prompt
                              ↓
                        Show Popup
                              ↓
                     User Accepts Help
                              ↓
        Multi-Agent Pipeline (6 specialized agents)
                              ↓
                   Personalized Summary
                              ↓
                    Display in Sidebar
```

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Development mode with watch
npm run build    # Production build
npm run preview  # Preview built extension
npm run lint     # Run ESLint
```

### Adding New Agents

1. Define agent function in `src/agents/agents.ts`:
   ```typescript
   export async function myAgent(state: AgentState): Promise<Partial<AgentState>> {
     // Agent logic
   }
   ```

2. Add prompts in `src/agents/prompts.ts`:
   ```typescript
   myAgent: {
     system: `You are...`,
     human: `Analyze...`
   }
   ```

3. Wire into graph in `src/agents/graph.ts`:
   ```typescript
   workflow.addNode("my_agent", myAgent);
   workflow.addEdge("previous_agent", "my_agent");
   ```

### Modifying Behavior Detection

Edit thresholds in `src/agents/classifier.ts`:

```typescript
function checkObviousStruggles(features: Features) {
  // Adjust detection sensitivity here
  if (features.scroll_reversal_count >= 1) { // Lower = more sensitive
    signals.push('User struggling');
  }
}
```

## ⚙️ Configuration

### OpenRouter API

FlowState uses OpenRouter for LLM access. Get a free API key at [openrouter.ai](https://openrouter.ai).

**Estimated costs**: ~$0.01-0.05 per summary (depends on page complexity and model choice)

### Model Selection

Configure models in `src/agents/classifier.ts` and `src/agents/agents.ts`:

```typescript
// Classifier model
model: 'google/gemini-2.0-flash-001'  // Fast, cheap, reliable

// Agent models (in agents.ts)
model: 'google/gemini-2.5-flash-lite'  // Default for most agents
```

### Behavior Thresholds

Adjust detection sensitivity in `src/content.ts`:

```typescript
const CLASSIFICATION_INTERVAL = 15000; // How often to check (ms)
const MIN_EVENTS_FOR_CLASSIFICATION = 2; // Minimum events needed
```

## 🛡️ Privacy

- **Local Processing**: Behavior tracking happens entirely in your browser
- **No Telemetry**: FlowState does not collect or send usage data
- **API Calls**: Page content is sent to OpenRouter only when you accept help
- **No Tracking**: No analytics, no cookies, no third-party scripts

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- [ ] Support for more LLM providers (Anthropic, OpenAI direct)
- [ ] Offline mode with local models
- [ ] More granular user preferences
- [ ] A/B testing framework for prompts
- [ ] Multi-language support
- [ ] Screen reader compatibility testing

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Mozilla Readability](https://github.com/mozilla/readability) for content extraction
- [OpenRouter](https://openrouter.ai) for unified LLM API access
- Inspired by accessibility research and neurodivergent community feedback

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/flowstate/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/flowstate/discussions)

---

**Note**: FlowState is a research project exploring AI-powered accessibility. It's not a replacement for professional medical or educational support.
