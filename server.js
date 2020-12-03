/**
 *  Server side JS file that is responsible for server connection to port
 */

var express = require("express");
var app = express();
var socket = require("socket.io");
var randomstring = require("randomstring");
const path = require('path');

var server = require('http').createServer(app);

/** Server code **/
server.listen(process.env.PORT || 3000);
console.log('Server running...');

// app setup type and and imports
app.set("view engine", "ejs");
app.use(express.static("assets"));

// app starts from index
app.get("/", function(req, res) {
    res.render("index");
});


/////////////////////////////////////////////
////////////// SERVER ACTIVITY //////////////
/////////////////////////////////////////////

// Sets up server to the correct port

// for deployed app
// if (process.env.PORT) {
//     var server = app.listen(process.env.PORT||80, process.env.IP, function() {
//         console.log("Server running...");
//     });
// } else {
//     var server = app.listen(3000, function() {
//         console.log("Server running...");
//     });
// }

//Socket Setup
var io = socket(server);
//GAME VARIABLES
var choice1 = "",
    choice2 = "";
var players = [];

//FUNCTIONS

//Function to calculate winner
function getWinner(p, c) {
    
    if (p === c) {
        return "draw";
    } else if (p === "rock") {
        if (c === "paper" || c === "spock") {
            return "2";
        } else {
            return "1";
        }
    } else if (p === "paper") {
        if (c === "scissors" || c === "lizard") {
            return "2";
        } else {
            return "1";
        }
    } else if (p === "scissors") {
        if (c === "rock" || c === "spock") {
            return "2";
        } else {
            return "1";
        }
    } else if (p === "lizard") {
        if (c === "rock" || c === "scissors") {
            return "2";
        } else {
            return "1";
        }
    } else if (p === "spock") {
        if (c === "paper" || c === "lizard") {
            return "2";
        } else {
            return "1";
        }
    }
}
//Function to do executed after gettin both choices
function result(roomID) {
    var winner = getWinner(choice1, choice2);
    io.sockets.to(roomID).emit("result", {
        winner: winner,
        choice1: choice1,
        choice2: choice2
    });
    choice1 = "";
    choice2 = "";
}
//Socket Connection
io.on("connection", function(socket) {
    console.log("made connection with socket");

    //Disconnect
    socket.on("disconnect", function(data) {
        if(socket.isMultiplayerGame) {
            var leavingPlayer = players.find(player => player.socket === socket.id);
            players = players.filter(player => player.socket !== leavingPlayer.socket);
            var playingPlayer = players.find(player => player.room === leavingPlayer.room);
            var playingPlayerSocket = io.sockets.sockets[playingPlayer.socket];
            playingPlayerSocket.isMultiplayerGame = false;
            socket.isMultiplayerGame = false;
            playingPlayerSocket.emit("informAboutExit", {
                player : playingPlayer,
                leaver : leavingPlayer
            });
        }

        io.of("/")
            .in(data.room)
            .clients((error, socketIds) => {
                if (error) throw error;
                socketIds.forEach(socketId =>
                    io.sockets.sockets[socketId].leave("chat")
                );
            });
    });

    //Create Game Listener
    socket.on("createGame", function(data) {
        var room = randomstring.generate({
            length: 4
        });
        players.push({
            socket : socket.id,
            name : data.name,
            room
        })
        socket.join(room);
        socket.isMultiplayerGame = true;
        socket.emit("newGame", {
            name: data.name,
            room: room
        });
    });
    //Join Game Listener
    socket.on("joinGame", function(data) {
        var room = io.nsps["/"].adapter.rooms[data.room];
        if (room) {
            if (room.length == 1) {
                socket.join(data.room);
                players.push({
                    socket : socket.id,
                    name : data.name,
                    room : data.room
                });
                socket.isMultiplayerGame = true;
                socket.broadcast.to(data.room).emit("player1", { oppName: data.name });
                socket.emit("player2", { name: data.name, room: data.room });
            } else {
                socket.emit("err", { message: "Sorry, The room is full!" });
            }
        } else {
            socket.emit("err", { message: "Invalid Room Key" });
        }
    });
    //Listener to pass the name of the game creater
    socket.on("joinedGame", function(data) {
        console.log("Joined Game ", data);
        socket.broadcast.to(data.room).emit("welcomeGame", data.player);
    });
    //Listener to Player 1's Choice
    socket.on("choice1", function(data) {
        choice1 = data.choice;
        console.log(choice1, choice2);
        if (choice2 != "") {
            result(data.room);
        }
    });
    //Listener to Player 2's Choice
    socket.on("choice2", function(data) {
        choice2 = data.choice;
        console.log(choice1, choice2);
        if (choice1 != "") {
            result(data.room);
        }
    });
});