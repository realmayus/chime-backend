const express = require('express')
const fetch = require("node-fetch");
const admin = require('firebase-admin');
const cors = require('cors');
const util = require("./util");
const uuidv4 = util.uuidv4;
const check_if_exists = util.check_if_exists;
const get_limited_array = util.get_limited_array;


admin.initializeApp({credential: admin.credential.cert(require("./secret/firebase_creds.json"))});

const app = express();
app.use(cors());
app.use(express.json());

const port = 5000;
const stat_cache_limit = 500;  //limit internat stats cache to the last 1500 datapoints each
const LAVALINK_URL = "http://0.0.0.0";
const LAVALINK_PORT = 2333;
const LAVALINK_PASSWORD = "youshallnotpass";

let urlregex = /[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)?/gi;
urlregex = new RegExp(urlregex);



let statsCache = {
    common_commands: get_limited_array(stat_cache_limit),
    non_existant_commands: get_limited_array(stat_cache_limit),
    users_listening: get_limited_array(stat_cache_limit),
    servers_listening: get_limited_array(stat_cache_limit),
    server_amount: get_limited_array(stat_cache_limit),
    latency: get_limited_array(stat_cache_limit),
    cpu_usage: get_limited_array(stat_cache_limit),
    ram_usage: get_limited_array(stat_cache_limit),
}

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
    if (fetchedInfo.status !== 200) {
        let json = await fetchedInfo.json();
        response.status(fetchedInfo.status).send({errorCode: "discordError", error: json.message});
        return;
    }
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
                response.send({user_id, user_name, avatar_url, data: {user_id, playlists: []}})
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
    let user_id;
    const playlist = request.query.playlist
    const shareCode = request.query.sharecode
    let initialUserID;
    let initialPlaylistID
    if(shareCode == null) {
        if(token == null) {
            response.status(401).send({errorCode: "invalid-token", error: "You have to provide a valid discord API token!"});
            return;
        }
        if(playlist == null) {
            response.status(400).send({errorCode: "invalid-playlist", error: "You have to provide a playlist ID!"});
            return;
        }

        let fetchedInfo = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        if (fetchedInfo.status !== 200) {
            let json = await fetchedInfo.json();
            response.status(fetchedInfo.status).send({errorCode: "discordError", error: json.message});
            return;
        }
        fetchedInfo = await fetchedInfo.json();
        user_id = fetchedInfo.id;

    } else {
        const decodedShareCode = decodeURIComponent(escape(Buffer.from(shareCode, 'base64').toString()));
        if(decodedShareCode.indexOf(':') !== -1 && decodedShareCode.split(":").length >= 2) {
            initialUserID = decodedShareCode.split(":")[0]

            initialPlaylistID = decodedShareCode.split(":")[1]
        } else {
            response.status(400).send({errorCode: "invalid-sharecode", error: "You have to provide a valid sharecode!"});
            return;
        }
    }



    admin.firestore()
        .collection(String(user_id || initialUserID))
        .doc(String(playlist || initialPlaylistID))
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
    if (fetchedInfo.status !== 200) {
        let json = await fetchedInfo.json();
        response.status(fetchedInfo.status).send({errorCode: "discordError", error: json.message});
        return;
    }
    fetchedInfo = await fetchedInfo.json();
    let user_id = fetchedInfo.id;
    if(user_id) {
        let i = 0;
        let has_results = false
        let res = undefined
        do {
            res = await fetch(LAVALINK_URL + ":" + LAVALINK_PORT + "/loadtracks?identifier=" + encodeURIComponent(query.match(urlregex) ? query : "ytsearch:" + query), {headers: {Authorization: LAVALINK_PASSWORD}})
            res = await res.json();
            if(res.loadType !== "NO_MATCHES") {
                has_results = true;
            }
            i++;
        } while (has_results === false && i < 5)
        response.send(res);
    } else {
        response.status(403).send({errorCode: "unauthorized", error: "unauthorized"})
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
    if (fetchedInfo.status !== 200) {
        let json = await fetchedInfo.json();
        response.status(fetchedInfo.status).send({errorCode: "discordError", error: json.message});
        return;
    }
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
    if (fetchedInfo.status !== 200) {
        let json = await fetchedInfo.json();
        response.status(fetchedInfo.status).send({errorCode: "discordError", error: json.message});
        return;
    }
    fetchedInfo = await fetchedInfo.json();
    let user_id = fetchedInfo.id;

    let profile_doc_ref = admin.firestore()
        .collection(String(user_id))
        .doc("profile")
    profile_doc = await profile_doc_ref.get()
    let does_exist = await check_if_exists(profile_doc, playlist);
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


app.get('/clonePlaylist', async (request, response) => {
    response.set('Access-Control-Allow-Origin', "*")
    response.set('Access-Control-Allow-Methods', 'GET, POST')

    const token = request.query.token
    const playlist = request.query.playlist
    const newName = request.query.newName
    const shareCode = request.query.sharecode
    let initalUserID = null
    let initialPlaylistID = null


    if (shareCode == null) {
        if(token == null) {
            response.status(401).send({errorCode: "invalid-token", error: "You have to provide a valid discord API token!"});
            return;
        }
        if(playlist == null) {
            response.status(400).send({errorCode: "invalid-playlist", error: "You have to provide a playlist id!"});
            return;
        }
    } else {
        const decodedShareCode = decodeURIComponent(escape(Buffer.from(shareCode, 'base64').toString()));
        if(decodedShareCode.indexOf(':') !== -1 && decodedShareCode.split(":").length >= 2) {
            initalUserID = decodedShareCode.split(":")[0]
            initialPlaylistID = decodedShareCode.split(":")[1]
        } else {
            response.status(400).send({errorCode: "invalid-sharecode", error: "You have to provide a valid sharecode!"});
            return;
        }
    }
    if(newName == null) {
        response.status(400).send({errorCode: "invalid-name", error: "You have to provide a newName!"});
        return;
    }
    let fetchedInfo = await fetch("https://discord.com/api/users/@me", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    if (fetchedInfo.status !== 200) {
        let json = await fetchedInfo.json();
        response.status(fetchedInfo.status).send({errorCode: "discordError", error: json.message});
        return;
    }
    fetchedInfo = await fetchedInfo.json();
    let user_id = fetchedInfo.id;
    if (user_id != null) {
        // CREATE NEW PLAYLIST
        let profile_doc_ref = admin.firestore()
            .collection(String(user_id))
            .doc("profile")
        profile_doc = await profile_doc_ref.get()
        let does_exist = await check_if_exists(profile_doc, newName);

        if(does_exist) {
            response.status(400).send({errorCode: "already-exists", error: "A playlist with this name already exists"});
            return
        }
        let new_id = uuidv4();

        if(profile_doc.exists) {
            await profile_doc_ref.update({playlists: admin.firestore.FieldValue.arrayUnion({"name": newName, "ref": new_id})})
        } else {
            await profile_doc_ref.set({playlists: [{"name": newName, "ref": new_id}]})
        }

        let new_playlist_doc_ref = admin.firestore().collection(String(user_id)).doc(new_id);
        await new_playlist_doc_ref.set({contents: []})

        let playlist_doc_ref;
        //GET OLD PLAYLIST
        let data = null;
        if(initalUserID == null) {
            playlist_doc_ref = admin.firestore()
                .collection(String(user_id))
                .doc(String(playlist))
            let playlist_doc = await playlist_doc_ref.get()
            data = playlist_doc.data();
        } else {
            playlist_doc_ref = admin.firestore()
                .collection(String(initalUserID))
                .doc(String(initialPlaylistID))
            let playlist_doc = await playlist_doc_ref.get()
            data = playlist_doc.data();
        }

        //SET NEW PLAYLIST
        await new_playlist_doc_ref.set(data);
        response.status(200).send({status: "OK", id: new_id})

    } else {
        response.status(403).send({errorCode: "unauthorized", error: "unauthorized"})
    }
})


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
    if (fetchedInfo.status !== 200) {
        let json = await fetchedInfo.json();
        response.status(fetchedInfo.status).send({errorCode: "discordError", error: json.message});
        return;
    }
    fetchedInfo = await fetchedInfo.json();
    let user_id = fetchedInfo.id;
    if (user_id != null) {
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
    } else {
        response.status(403).send({errorCode: "unauthorized", error: "unauthorized"})
    }

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
    if (fetchedInfo.status !== 200) {
        let json = await fetchedInfo.json();
        response.status(fetchedInfo.status).send({errorCode: "discordError", error: json.message});
        return;
    }
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
    if(does_exist) {
        response.status(400).send({errorCode: "already-exists", error: "A playlist with this name already exists"});
        return
    }


    playlists[index] = {name: newName, ref: playlist}  // replacing the playlist in place

    await profile_doc_ref.update({playlists: playlists})

    response.status(200).send({status: "OK"})
});


app.listen(port, () => console.log(`Chime backend listening at http://localhost:${port}`))