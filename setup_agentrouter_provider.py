import re

# 1. Update shared/llm-providers.ts
providers_path = 'D:/WhopClipper/OpenChatCut/shared/llm-providers.ts'
with open(providers_path, 'r', encoding='utf-8') as f:
    prov_code = f.read()

agentrouter_preset = """  {
    id: 'agentrouter',
    label: 'AgentRouter · Astra',
    protocol: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:8318/v1',
    defaultModel: 'gpt-6-astra',
  },
"""

if "'agentrouter'" not in prov_code:
    # Insert right before cheaperinference or ollama
    target = "  {\n    id: 'cheaperinference',"
    if target in prov_code:
        prov_code = prov_code.replace(target, agentrouter_preset + target)
    else:
        target_crlf = "  {\r\n    id: 'cheaperinference',"
        prov_code = prov_code.replace(target_crlf, agentrouter_preset.replace('\n', '\r\n') + target_crlf)

    # Update isLocalLlmProvider
    old_local = "return normalized === 'ollama' || normalized === 'lmstudio';"
    new_local = "return normalized === 'ollama' || normalized === 'lmstudio' || normalized === 'agentrouter';"
    prov_code = prov_code.replace(old_local, new_local)

    with open(providers_path, 'w', encoding='utf-8') as f:
        f.write(prov_code)
    print("Updated shared/llm-providers.ts!")
else:
    print("agentrouter already in shared/llm-providers.ts")

# 2. Update shared/model-capabilities.ts
caps_path = 'D:/WhopClipper/OpenChatCut/shared/model-capabilities.ts'
with open(caps_path, 'r', encoding='utf-8') as f:
    caps_code = f.read()

if "AGENTROUTER_BUILTIN_OVERRIDES" not in caps_code:
    override_def = """const AGENTROUTER_BUILTIN_OVERRIDES: readonly ModelCapabilityOverride[] = [
  'gpt-6-astra', 'gpt-6.1-sol', 'gpt-5.6-sol'
].map((modelId) => ({
  backend: 'api' as const,
  provider: 'agentrouter' as LlmProvider,
  modelId,
  contextWindowTokens: 256_000,
  maxInputTokens: 200_000,
  maxOutputTokens: 16_384,
  supportsTools: true,
  supportsImages: true,
  supportsReasoning: true,
}));

"""
    # Insert right after CLAUDE_CODE_BUILTIN_OVERRIDES definition
    target_claude = "const CLAUDE_CODE_BUILTIN_OVERRIDES: readonly ModelCapabilityOverride[] = ["
    idx = caps_code.find(target_claude)
    if idx != -1:
        semicolon_idx = caps_code.find("];", idx)
        if semicolon_idx != -1:
            insertion_point = semicolon_idx + 2
            caps_code = caps_code[:insertion_point] + "\n" + override_def + caps_code[insertion_point:]

    # Update resolveModelCapabilities
    old_res = "const builtinOverride = findModelCapabilityOverride(CLAUDE_CODE_BUILTIN_OVERRIDES, identity);"
    new_res = """const agentrouterOverride = findModelCapabilityOverride(AGENTROUTER_BUILTIN_OVERRIDES, identity);
  const builtinOverride = findModelCapabilityOverride(CLAUDE_CODE_BUILTIN_OVERRIDES, identity) || agentrouterOverride;"""
    caps_code = caps_code.replace(old_res, new_res)

    with open(caps_path, 'w', encoding='utf-8') as f:
        f.write(caps_code)
    print("Updated shared/model-capabilities.ts!")
else:
    print("AGENTROUTER_BUILTIN_OVERRIDES already in model-capabilities.ts")

# 3. Update server/keystore-names.ts
names_path = 'D:/WhopClipper/OpenChatCut/server/keystore-names.ts'
with open(names_path, 'r', encoding='utf-8') as f:
    names_code = f.read()

if "LLM_AGENTROUTER_API_KEY" not in names_code:
    target_cheaper = '  "LLM_CHEAPERINFERENCE_API_KEY",'
    agentrouter_keys = """  "LLM_AGENTROUTER_API_KEY",
  "LLM_AGENTROUTER_BASE_URL",
  "LLM_AGENTROUTER_MODEL",
"""
    if target_cheaper in names_code:
        names_code = names_code.replace(target_cheaper, agentrouter_keys + target_cheaper)
    else:
        target_cheaper_crlf = '  "LLM_CHEAPERINFERENCE_API_KEY",'.replace('\n', '\r\n')
        names_code = names_code.replace(target_cheaper_crlf, agentrouter_keys.replace('\n', '\r\n') + target_cheaper_crlf)

    with open(names_path, 'w', encoding='utf-8') as f:
        f.write(names_code)
    print("Updated server/keystore-names.ts!")
else:
    print("LLM_AGENTROUTER_API_KEY already in keystore-names.ts")

# 4. Update src/components/settings/vendorIcons.tsx
icons_path = 'D:/WhopClipper/OpenChatCut/src/components/settings/vendorIcons.tsx'
with open(icons_path, 'r', encoding='utf-8') as f:
    icons_code = f.read()

if "'agentrouter'" not in icons_code:
    old_type = "| 'llm' | 'anthropic'"
    new_type = "| 'llm' | 'agentrouter' | 'anthropic'"
    icons_code = icons_code.replace(old_type, new_type)

    old_mono = "llm: { bg: '#34363c', mono: 'AI', fg: '#f7f7f8' },"
    new_mono = """agentrouter: { bg: '#6366f1', mono: 'AR', fg: '#ffffff' },
  llm: { bg: '#34363c', mono: 'AI', fg: '#f7f7f8' },"""
    icons_code = icons_code.replace(old_mono, new_mono)

    with open(icons_path, 'w', encoding='utf-8') as f:
        f.write(icons_code)
    print("Updated vendorIcons.tsx!")
else:
    print("agentrouter already in vendorIcons.tsx")

# 5. Update OpenChatCut/.env.local
env_local_path = 'D:/WhopClipper/OpenChatCut/.env.local'
with open(env_local_path, 'r', encoding='utf-8') as f:
    env_content = f.read()

agentrouter_env_lines = """LLM_AGENTROUTER_API_KEY=sk-VgxdXqC7zZRza6Cvwp4ExflA6ZK7bFMehAGEQaOlnxXTE4hq
LLM_AGENTROUTER_BASE_URL=http://127.0.0.1:8318/v1
LLM_AGENTROUTER_MODEL=gpt-6-astra
"""

if "LLM_AGENTROUTER_API_KEY" not in env_content:
    env_content = env_content.replace("LLM_PROVIDER=claude-code", "LLM_PROVIDER=agentrouter\nLLM_MODEL=gpt-6-astra\n" + agentrouter_env_lines)
    with open(env_local_path, 'w', encoding='utf-8') as f:
        f.write(env_content)
    print("Updated OpenChatCut/.env.local!")
else:
    print("LLM_AGENTROUTER_API_KEY already in .env.local")

# 6. Update D:/WhopClipper/.env
root_env_path = 'D:/WhopClipper/.env'
with open(root_env_path, 'r', encoding='utf-8') as f:
    root_env = f.read()

if "LLM_AGENTROUTER_API_KEY" not in root_env:
    root_env += "\n" + agentrouter_env_lines + "\nLLM_PROVIDER=agentrouter\nLLM_MODEL=gpt-6-astra\n"
    with open(root_env_path, 'w', encoding='utf-8') as f:
        f.write(root_env)
    print("Updated D:/WhopClipper/.env!")
else:
    print("LLM_AGENTROUTER_API_KEY already in root .env")

print("All configuration scripts applied!")
