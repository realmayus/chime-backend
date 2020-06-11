const functions = require('firebase-functions');
const fetch = require("node-fetch");
const admin = require('firebase-admin');
admin.initializeApp({credential: admin.credential.cert(require("./secret/firebase_creds.json"))});

exports.getProfile =  functions.https.onRequest(async (request, response) => {
    const token = request.query.token
    if(token === null || token === undefined) {
        response.send("You have to provide a token!");
        return;
    }
    let fetchedInfo = await fetch("https://discord.com/api/users/@me", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    fetchedInfo = await fetchedInfo.json();
    let user_id = fetchedInfo.id;
    let user_name = fetchedInfo.username;
    let avatar_url = "https://cdn.discordapp.com/avatars/" + user_id + "/" + fetchedInfo.avatar + ".png";

    admin.firestore()
        .collection(String(user_id))
        .doc("profile")
        .get()
        .then(doc => {
            if(!doc.exists) {
                response.send({user_id, playlists: []})
                return null;
            }
            let data = doc.data();
            response.send({user_id, user_name, avatar_url, data});
            return null;
        })
        .catch(err => {
            response.send("An error occurred: <code>" + err.text + "</code>")
            console.log(err)
        })
});


exports.getPlaylist =  functions.https.onRequest(async (request, response) => {
    const token = request.query.token
    const playlist = request.query.playlist


    if(token === null || token === undefined) {
        response.send("You have to provide a token!");
        return;
    }
    if(playlist === null || playlist === undefined) {
        response.send("You have to provide a playlist!");
        return;
    }

    let fetchedInfo = await fetch("https://discord.com/api/users/@me", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    fetchedInfo = await fetchedInfo.json();
    let user_id = fetchedInfo.id;

    admin.firestore()
        .collection(String(user_id))
        .doc(String(playlist))
        .get()
        .then(doc => {
            if(!doc.exists) {
                response.send({"errorCode": "not-existing", "error": "The provided playlist ID doesn't point to an existing playlist."})
                response.sendStatus(404);
                return null;
            }
            let data = doc.data();
            response.send({data});
            return null;
        })
        .catch(err => {
            response.send("An error occurred: <code>" + err.text + "</code>")
            console.log(err)
        })
});
