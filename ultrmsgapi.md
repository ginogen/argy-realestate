Get Started with Whatsapp API
Ultramsg Api enabling you to integrate any of your applications with our whatsapp message sending and receiving system.

you will find everything you need in your favorite languages to sample apps for web, iOS, and Android.

The main advantage of our system is its simplicity of implementation.

Every message sent from our system has its own unique id, which allows you to receive confirmation of its delivery.

Send your first message!
Ultramsg account is required to run examples. Log in or Create Account if you dont have one.
go to your instance or Create one if you haven't already.
Scan Qr and make sure that instance Auth Status : authenticated
Start sending Messages

Send a text message to phone number or group
POST
API
Messages
Chat
Instance ID

Token

Request test
Advanced Mode
Note :
in case the instance not authorized , the message will add to queue and will be sent when the WhatsApp instance is ready.
To :

Phone with international format e.g. +1408XXXXXXX , or chatID for contact or group
Body :

Request
Response
Request URL
https://api.ultramsg.com/{{instance_id}}/messages/chat
Request body
token
*Required
to
*Required
Phone number with international format e.g. +14155552671
or
chatID for contact or group e.g 14155552671@c.us or 14155552671-441234567890@g.us

body
\*Required
Message text, UTF-8 or UTF-16 string with emoji
Max length : 4096 characters .
Request samples
Json

Note : don't forget to URL encode your query params like base64 or utf-8
© 2021 - 2025. UltraMsg.com

Send a image to phone number or group
POST
API
Messages
Image
Instance ID

Token

Request test
Advanced Mode
To :

Phone with international format e.g. +1408XXXXXXX , or chatID for contact or group
Image :

Caption :

Request
Response
Request URL
https://api.ultramsg.com/{{instance_id}}/messages/image
Request body
token
*Required
to
*Required
Phone number with international format e.g. +14155552671
or
chatID for contact or group e.g 14155552671@c.us or 14155552671-441234567890@g.us

image
\*Required
HTTP link image or base64-encoded file

Supported extensions ( jpg , jpeg , gif , png , webp , bmp ) .

Max file size : 16MB .

Max Base64 length : 10,000,000 More info

example images links :

jpg : https://file-example.s3-accelerate.amazonaws.com/images/test.jpg

jpeg : https://file-example.s3-accelerate.amazonaws.com/images/test.jpeg

png : https://file-example.s3-accelerate.amazonaws.com/images/test.png

gif : https://file-example.s3-accelerate.amazonaws.com/images/test.gif

bmp : https://file-example.s3-accelerate.amazonaws.com/images/test.bmp

webp : https://file-example.s3-accelerate.amazonaws.com/images/test.webp

caption
The text under the file .
Data type : text, UTF-8 or UTF-16 string with emoji .
Max length : 1024 char .

Request samples
Json

Note : don't forget to URL encode your query params like base64 or utf-8
© 2021 - 2025. UltraMsg.com
