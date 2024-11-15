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
    "model": "openai/gpt-4o-2024-08-06",
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

# ---- run ----
# PromptlyCode  master @ python scripts/gpt4o_test.py
# {
#   "id": "gen-1731648193-EAa1Huqq4NZUWC5gNE41",
#   "provider": "OpenAI",
#   "model": "openai/gpt-4o-2024-08-06",
#   "object": "chat.completion",
#   "created": 1731648193,
#   "choices": [
#     {
#       "logprobs": null,
#       "finish_reason": "stop",
#       "index": 0,
#       "message": {
#         "role": "assistant",
#         "content": "To print each element of the array `arr: [1, 2, 6]`, you can simply iterate through the array and print each element individually. Here's how you can do it in Python:\n\n```python\narr = [1, 2, 6]\n\nfor element in arr:\n    print(element)\n```\n\nWhen you run this code, it will output:\n\n```\n1\n2\n6\n```\n\nIf you are using another programming language, let me know, and I can show you how to do it accordingly.",
#         "refusal": ""
#       }
#     }
#   ],
#   "system_fingerprint": "fp_45cf54deae",
#   "usage": {
#     "prompt_tokens": 24,
#     "completion_tokens": 110,
#     "total_tokens": 134
#   }
# }
# ========================
# 
# To print each element of the array `arr: [1, 2, 6]`, you can simply iterate through the array and print each element individually. Here's how you can do it in Python:
# 
# ```python
# arr = [1, 2, 6]
# 
# for element in arr:
#     print(element)
# ```
# 
# When you run this code, it will output:
# 
# ```
# 1
# 2
# 6
# ```
# 
# If you are using another programming language, let me know, and I can show you how to do it accordingly.
# 
