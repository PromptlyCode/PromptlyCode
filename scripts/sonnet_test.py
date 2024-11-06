import requests
import json
import os

question = "add for each print this array arr: [1, 2, 6]"

OPENROUTER_API_KEY = os.environ['OPENROUTER_API_KEY']

response = requests.post(
  url="https://openrouter.ai/api/v1/chat/completions",
  headers={
    "Authorization": f"Bearer {OPENROUTER_API_KEY}"
  },
  data=json.dumps({
    "model": "anthropic/claude-3.5-sonnet", # Optional
    "messages": [
      {"role": "user", "content": question}
    ],
    "top_p": 1,
    "temperature": 1,
    "frequency_penalty": 0,
    "presence_penalty": 0,
    "repetition_penalty": 1,
    "top_k": 0,
  })
)

# Output the JSON response in a format compatible with jq.
if response.status_code == 200:
    print(json.dumps(response.json(), indent=2))  # Use `json.dumps` to ensure valid JSON output
    print("========================\n")
    print(response.json()['choices'][0]['message']['content'])
else:
    print(json.dumps({"error": f"Error: {response.status_code}", "message": response.text}, indent=2))

