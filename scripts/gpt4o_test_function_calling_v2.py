import requests
import json
import os
from typing import Dict, List, Optional

OPENROUTER_API_KEY = os.environ['OPENROUTER_API_KEY']

def check_file_exists(file_path: str) -> Dict[str, bool]:
    """
    Check if a file exists and return its status.
    """
    return {
        "exists": os.path.exists(file_path),
        "is_file": os.path.isfile(file_path),
        "is_directory": os.path.isdir(file_path)
    }

def get_file_info(file_path: str) -> Optional[Dict]:
    """
    Get detailed file information if the file exists.
    """
    if not os.path.exists(file_path):
        return None
    
    return {
        "size": os.path.getsize(file_path),
        "last_modified": os.path.getmtime(file_path),
        "permissions": oct(os.stat(file_path).st_mode)[-3:],
        "is_readable": os.access(file_path, os.R_OK),
        "is_writable": os.access(file_path, os.W_OK)
    }

def execute_tool_call(tool_call: Dict) -> Dict:
    """
    Execute a tool call and return the result
    """
    if tool_call["function"]["name"] == "check_file_status":
        args = json.loads(tool_call["function"]["arguments"])
        file_path = args["file_path"]
        check_type = args.get("check_type", "basic")
        
        result = check_file_exists(file_path)
        if check_type == "detailed" and result["exists"]:
            result["detailed"] = get_file_info(file_path)
            
        return {
            "tool_call_id": tool_call["id"],
            "role": "tool",
            "name": "check_file_status",
            "content": json.dumps(result)
        }
    return None

def make_api_request(question: str, messages: List[Dict] = None) -> Dict:
    """
    Make API request with tool calls and handle the response cycle
    """
    if messages is None:
        messages = []
    
    messages.append({"role": "user", "content": question})
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "openai/gpt-4o-2024-08-06",
        "messages": messages,
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
        "temperature": 1
    }
    
    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            data=json.dumps(payload)
        )
        response.raise_for_status()
        response_data = response.json()
        
        # Handle tool calls if present
        if (response_data.get("choices") and 
            response_data["choices"][0]["finish_reason"] == "tool_calls" and
            response_data["choices"][0]["message"].get("tool_calls")):
            
            # Execute each tool call
            tool_results = []
            for tool_call in response_data["choices"][0]["message"]["tool_calls"]:
                result = execute_tool_call(tool_call)
                if result:
                    tool_results.append(result)
            
            # If we got tool results, add them to messages and make another request
            if tool_results:
                messages.append(response_data["choices"][0]["message"])
                messages.extend(tool_results)
                return make_api_request("", messages)  # Continue the conversation
                
        return response_data
        
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # Example usage
    result = make_api_request("What's in the data directory?  path: /Users/clojure/EmacsPyPro/learn-autogen")
    print(json.dumps(result, indent=2))

# ----- run function calling is ok --------
# {
#   "id": "gen-1731649344-2T9gDj0xXgNydUC9a9Qa",
#   "provider": "OpenAI",
#   "model": "openai/gpt-4o-2024-08-06",
#   "object": "chat.completion",
#   "created": 1731649344,
#   "choices": [
#     {
#       "logprobs": null,
#       "finish_reason": "stop",
#       "index": 0,
#       "message": {
#         "role": "assistant",
#         "content": "The directory at path `/Users/clojure/EmacsPyPro/learn-autogen` is accessible and has the following attributes:\n\n- It's a directory, not a file.\n- The directory size is 416 bytes.\n- The last modification time was on `1731637221.5211265` (in Unix timestamp format).\n- It has read and write permissions set (permissions: `755`).\n\nLet me know if you'd like to perform any further actions or check the contents of this directory.",
#         "refusal": ""
#       }
#     }
#   ],
#   "system_fingerprint": "fp_45cf54deae",
#   "usage": {
#     "prompt_tokens": 325,
#     "completion_tokens": 103,
#     "total_tokens": 428
#   }
# }
