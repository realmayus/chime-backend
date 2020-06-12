const express = require('express')
const fetch = require("node-fetch");
const admin = require('firebase-admin');

admin.initializeApp({credential: admin.credential.cert(require("./secret/firebase_creds.json"))});

const app = express()
const port = 5000

app.get('/getProfile', async (request, response) => {
    response.set('Access-Control-Allow-Origin', "*")
    response.set('Access-Control-Allow-Methods', 'GET, POST')

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


app.get('/getPlaylist', async (request, response) => {
    response.set('Access-Control-Allow-Origin', "*")
    response.set('Access-Control-Allow-Methods', 'GET, POST')

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
                response.status(404).send({"errorCode": "not-existing", "error": "The provided playlist ID doesn't point to an existing playlist."})
                return null;
            }
            let data = doc.data();
            response.send({data});
            return null;
        })
        .catch(err => {
            response.status(500).send("An error occurred: <code>" + err.text + "</code>")
            console.log(err)
        })
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))