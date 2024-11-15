import requests
import json
import os
from typing import Dict, List, Optional

OPENROUTER_API_KEY = os.environ['OPENROUTER_API_KEY']

def check_file_exists(file_path: str) -> Dict[str, bool]:
    """
    Check if a file exists and return its status.
    """
    print(f"-------{file_path}-----=======")
    return {
        "exists": os.path.exists(file_path),
        "is_file": os.path.isfile(file_path),
        "is_directory": os.path.isdir(file_path)
    }

def get_file_info(file_path: str) -> Optional[Dict]:
    """
    Get detailed file information if the file exists.
    """
    print(f"-------{file_path}-----")
    if not os.path.exists(file_path):
        return None
    
    return {
        "size": os.path.getsize(file_path),
        "last_modified": os.path.getmtime(file_path),
        "permissions": oct(os.stat(file_path).st_mode)[-3:],
        "is_readable": os.access(file_path, os.R_OK),
        "is_writable": os.access(file_path, os.W_OK)
    }

def make_api_request(question: str, file_paths: List[str] = None) -> Dict:
    """
    Make API request with optional file status checks using tool calls.
    """
    # First check file statuses if provided
    file_statuses = {}
    if file_paths:
        for file_path in file_paths:
            file_statuses[file_path] = {
                "status": check_file_exists(file_path),
                "info": get_file_info(file_path)
            }
    
    # Prepare the API request
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "openai/gpt-4o-2024-08-06",
        "messages": [
            {"role": "user", "content": question}
        ],
        "tools": [{
            "type": "function",
            "function": {
                "name": "check_file_status",
                "description": "Check the status and information of local files",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Path to the file to check"
                        },
                        "check_type": {
                            "type": "string",
                            "enum": ["basic", "detailed"],
                            "description": "Type of check to perform (basic: existence only, detailed: full file info)"
                        }
                    },
                    "required": ["file_path"]
                }
            }
        }],
        "top_p": 1,
        "temperature": 1,
        "frequency_penalty": 0,
        "presence_penalty": 0,
        "repetition_penalty": 1,
        "top_k": 0
    }
    
    # Add file statuses to the request if any were checked
    if file_statuses:
        payload["file_statuses"] = file_statuses
    
    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            data=json.dumps(payload)
        )
        response.raise_for_status()
        return response.json()
    
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

# Example usage
if __name__ == "__main__":
    # Example with file checks
    result = make_api_request(
        question="What's in the data directory?",
        file_paths=["/Users/clojure/Desktop/PromptlyCode/README.md", "/Users/clojure/EmacsPyPro/learn-autogen"]
    )
    print(json.dumps(result, indent=2))

    # Example handling tool calls response
    if "choices" in result and result["choices"][0].get("tool_calls"):
        for tool_call in result["choices"][0]["tool_calls"]:
            if tool_call["function"]["name"] == "check_file_status":
                args = json.loads(tool_call["function"]["arguments"])
                file_status = check_file_exists(args["file_path"])
                if args.get("check_type") == "detailed":
                    file_status.update({"detailed": get_file_info(args["file_path"])})
                print(f"File status for {args['file_path']}:", json.dumps(file_status, indent=2))

# -------- run ------
# @ python scripts/gpt4o_test_function_calling.py
# -------/Users/clojure/Desktop/PromptlyCode/README.md-----=======
# -------/Users/clojure/Desktop/PromptlyCode/README.md-----
# -------/Users/clojure/EmacsPyPro/learn-autogen-----=======
# -------/Users/clojure/EmacsPyPro/learn-autogen-----
# {
#   "id": "gen-1731648987-6Xgr2BsLlIkg1vzATMLV",
#   "provider": "OpenAI",
#   "model": "openai/gpt-4o-2024-08-06",
#   "object": "chat.completion",
#   "created": 1731648987,
#   "choices": [
#     {
#       "logprobs": null,
#       "finish_reason": "tool_calls",
#       "index": 0,
#       "message": {
#         "role": "assistant",
#         "content": null,
#         "refusal": null,
#         "tool_calls": [
#           {
#             "index": 0,
#             "id": "call_OppLO4nyQRIMmPXiWZC4v3W6",
#             "type": "function",
#             "function": {
#               "name": "check_file_status",
#               "arguments": "{\"file_path\":\"data\",\"check_type\":\"detailed\"}"
#             }
#           }
#         ]
#       }
#     }
#   ],
#   "system_fingerprint": "fp_45cf54deae",
#   "usage": {
#     "prompt_tokens": 90,
#     "completion_tokens": 22,
#     "total_tokens": 112
#   }
# }
