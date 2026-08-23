import requests
user_msg = "can you tell me about overflow anime"

req_msg = {"message": user_msg}

url = "https://ladle-cache-suggest.ngrok-free.dev/webhook-test/3211b964-8367-4322-8669-c4c6cfc1bb94"

res = requests.post(url, json=req_msg)

print(res.status_code)

print(res.json()[0]['output'])