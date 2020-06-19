const express = require('express')
const fetch = require("node-fetch");
const admin = require('firebase-admin');
const cors = require('cors');
const util = require("./util");
const uuidv4 = util.uuidv4;
const check_if_exists = util.check_if_exists;

admin.initializeApp({credential: admin.credential.cert(require("./secret/firebase_creds.json"))});

const app = express();
app.use(cors());
app.use(express.json());

const port = 5000;

app.get('/getProfile', async (request, response) => {
    response.set('Access-Control-Allow-Origin', "*")
    response.set('Access-Control-Allow-Methods', 'GET, POST')

    const token = request.query.token
    if(token === null || token === undefined) {
        response.status(401).send({errorCode: "invalid-token", error: "You have to provide a valid discord API token!"});
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
            response.status(500).send({errorCode: "unknown", error: "An unknown error occurred: " + err});
            console.log(err)
        })
});


app.get('/getPlaylist', async (request, response) => {
    response.set('Access-Control-Allow-Origin', "*")
    response.set('Access-Control-Allow-Methods', 'GET, POST')

    const token = request.query.token
    const playlist = request.query.playlist


    if(token === null || token === undefined) {
        response.status(401).send({errorCode: "invalid-token", error: "You have to provide a valid discord API token!"});
        return;
    }
    if(playlist === null || playlist === undefined) {
        response.status(400).send({errorCode: "invalid-playlist", error: "You have to provide a playlist ID!"});
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
                response.status(404).send({errorCode: "not-existing", error: "The provided playlist ID doesn't point to an existing playlist."})
                return null;
            }
            let data = doc.data();
            response.send({data});
            return null;
        })
        .catch(err => {
            response.status(500).send({errorCode: "unknown", error: "An unknown error occurred: " + err});
            console.log(err)
        })
});

app.get("/getSearchResults", async(request, response) => {
    response.set('Access-Control-Allow-Origin', "*")
    response.set('Access-Control-Allow-Methods', 'GET, POST')

    const token = request.query.token
    const query = request.query.query

    if(token === null || token === undefined) {
        response.status(401).send({errorCode: "invalid-token", error: "You have to provide a valid discord API token (to prevent abuse)"});
        return;
    }
    if(query === null || query === undefined || query.length === 0) {
        response.status(400).send({errorCode: "invalid-query", error: "You have to provide a (valid) query!"});
        return;
    }
    let fetchedInfo = await fetch("https://discord.com/api/users/@me", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    fetchedInfo = await fetchedInfo.json();
    let user_id = fetchedInfo.id;
    if(user_id) {
        let results = [];
        let iterations = 0;
        do {
            let fetchedInfo = await fetch("http://youtube-scrape.herokuapp.com/api/search?q=" + encodeURIComponent(query));
            fetchedInfo = await fetchedInfo.json();
            results = fetchedInfo.results;
            iterations++;
        } while (results.length === 0 && iterations < 5)

        if (results.length > 0) {
            response.send({results});
        } else {
            response.status(404).send({errorCode: "no-results", error: "Couldn't find any results."});
        }

    } else {
        response.status(403).send({errorCode: "invalid-token", error: "You have to provide a valid discord API token (to prevent abuse)"});
    }
})


app.post('/setPlaylist', async (request, response) => {
    response.set('Access-Control-Allow-Origin', "*")
    response.set('Access-Control-Allow-Methods', 'GET, POST')

    const token = request.query.token
    const playlist = request.query.playlist

    if(token === null || token === undefined) {
        response.status(401).send({errorCode: "invalid-token", error: "You have to provide a valid discord API token!"});
        return;
    }
    if(playlist === null || playlist === undefined) {
        response.status(400).send({errorCode: "invalid-playlist", error: "You have to provide a playlist ID!"});
        return;
    }

    let fetchedInfo = await fetch("https://discord.com/api/users/@me", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    fetchedInfo = await fetchedInfo.json();
    let user_id = fetchedInfo.id;

    let doc = admin.firestore()
        .collection(String(user_id))
        .doc(String(playlist))

    let docFetched = await doc.get()

    if(!docFetched.exists) {
        response.status(404).send({errorCode: "not-existing", error: "The provided playlist ID doesn't point to an existing playlist."})
    }

    doc.set(
            { contents: request.body.cards }
        )
        .then(res => {
            console.log(res)
            console.log("success!")
            response.status(200).send({status: "OK"});
        }).catch(err => {
            console.log(err)
            response.status(500).send({status: "ERR", error: err});
        })
});


app.get('/createPlaylist', async (request, response) => {
    response.set('Access-Control-Allow-Origin', "*")
    response.set('Access-Control-Allow-Methods', 'GET, POST')

    const token = request.query.token
    const playlist = request.query.playlist

    if(token === null || token === undefined) {
        response.status(401).send({errorCode: "invalid-token", error: "You have to provide a valid discord API token!"});
        return;
    }
    if(playlist === null || playlist === undefined) {
        response.status(400).send({errorCode: "invalid-name", error: "You have to provide a playlist name!"});
        return;
    }

    let fetchedInfo = await fetch("https://discord.com/api/users/@me", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    fetchedInfo = await fetchedInfo.json();
    let user_id = fetchedInfo.id;

    let profile_doc_ref = admin.firestore()
        .collection(String(user_id))
        .doc("profile")
    profile_doc = await profile_doc_ref.get()
    let does_exist = await check_if_exists(profile_doc, playlist);
    console.log(playlist)
    if(does_exist) {
        response.status(400).send({errorCode: "already-exists", error: "A playlist with this name already exists"});
        return
    }
    let new_id = uuidv4();

    if(profile_doc.exists) {
        await profile_doc_ref.update({playlists: admin.firestore.FieldValue.arrayUnion({"name": playlist, "ref": new_id})})
    } else {
        await profile_doc_ref.set({playlists: [{"name": playlist, "ref": new_id}]})
    }

    let playlist_doc_ref = admin.firestore().collection(String(user_id)).doc(new_id);
    await playlist_doc_ref.set({contents: []})
    response.status(200).send({status: "OK", id: new_id})
});


app.get('/deletePlaylist', async (request, response) => {
    response.set('Access-Control-Allow-Origin', "*")
    response.set('Access-Control-Allow-Methods', 'GET, POST')

    const token = request.query.token
    const playlist = request.query.playlist

    if(token === null || token === undefined) {
        response.status(401).send({errorCode: "invalid-token", error: "You have to provide a valid discord API token!"});
        return;
    }
    if(playlist === null || playlist === undefined) {
        response.status(400).send({errorCode: "invalid-playlist", error: "You have to provide a playlist id!"});
        return;
    }

    let fetchedInfo = await fetch("https://discord.com/api/users/@me", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    fetchedInfo = await fetchedInfo.json();
    let user_id = fetchedInfo.id;

    let profile_doc_ref = admin.firestore()
        .collection(String(user_id))
        .doc("profile")

    let profile_doc = await profile_doc_ref.get()

    let playlist_doc_ref = admin.firestore()
        .collection(String(user_id))
        .doc(String(playlist))

    let playlist_doc = await playlist_doc_ref.get()

    if(!playlist_doc.exists) {
        response.status(404).send({errorCode: "not-existing", error: "The provided playlist ID doesn't point to an existing playlist."})
        return
    }

    await profile_doc_ref.update({playlists: profile_doc.data().playlists.filter(pl => pl.ref !== playlist)})
    await playlist_doc_ref.delete();

    response.status(200).send({status: "OK"})
});

app.get('/renamePlaylist', async (request, response) => {
    response.set('Access-Control-Allow-Origin', "*")
    response.set('Access-Control-Allow-Methods', 'GET, POST')

    const token = request.query.token
    const playlist = request.query.playlist
    const newName = request.query.newName

    if(token === null || token === undefined) {
        response.status(401).send({errorCode: "invalid-token", error: "You have to provide a valid discord API token!"});
        return;
    }
    if(playlist === null || playlist === undefined) {
        response.status(400).send({errorCode: "invalid-playlist", error: "You have to provide a playlist id!"});
        return;
    }
    if(newName === null || newName === undefined) {
        response.status(400).send({errorCode: "invalid-newname", error: "You have to provide a new name!"});
        return;
    }
    let fetchedInfo = await fetch("https://discord.com/api/users/@me", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    fetchedInfo = await fetchedInfo.json();
    let user_id = fetchedInfo.id;
    let profile_doc_ref = admin.firestore()
        .collection(String(user_id))
        .doc("profile")

    let profile_doc = await profile_doc_ref.get()

    let playlist_doc_ref = admin.firestore()
        .collection(String(user_id))
        .doc(String(playlist))

    let playlist_doc = await playlist_doc_ref.get()

    if(!playlist_doc.exists) {
        response.status(404).send({errorCode: "not-existing", error: "The provided playlist ID doesn't point to an existing playlist."})
        return
    }

    let playlists = profile_doc.data().playlists;
    let index = playlists.indexOf(playlists.find(item => item.ref === playlist))
    if(index === -1) {
        response.status(404).send({errorCode: "not-existing", error: "The provided playlist ID doesn't point to an existing playlist in the user profile."})
        return
    }

    let does_exist = await check_if_exists(profile_doc, newName);
    console.log(playlist)
    if(does_exist) {
        response.status(400).send({errorCode: "already-exists", error: "A playlist with this name already exists"});
        return
    }


    playlists[index] = {name: newName, ref: playlist}  // replacing the playlist in place

    await profile_doc_ref.update({playlists: playlists})

    response.status(200).send({status: "OK"})
});



app.listen(port, () => console.log(`Chime backend listening at http://localhost:${port}`))