# chime-backend
The backend for chime, a free discord music bot.


## Firebase Credentials
Because the backend interfaces with a firebase database, you have to provide a service SDK token. Download it from the settings page of your firebase project and put it in the directory `secret/` and name it `firebase_creds.json`.

## Run
To run the server, make sure you have nodeJS installed.
Enter `node app.js` in your terminal to run the server.

## Install automatically
You can use this script to install the back- and frontend automatically:
https://gist.github.com/realmayus/42b4de34a21f8b27bf22f3e23038c984

**You WILL need to change the paths of some directories, i.e. everything that begins with /home/realmayus**
The script was made for Ubuntu, so not everything might work out of the box if you use it on another OS.
