const WebSocket = require('ws');
const uuidv1 = require('uuid/v1');
const db = require('./database/db');
console.log(db.get('messages').value());
console.log(db.get('fotos').value());

var dbUsers = []; // [{ws, user: {login, name}}, ...]
let dbFotos = {}; // {'login': foto, ...}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// массив пользователей без сокета
function dbUsersToUsers() {
    return dbUsers.map( dbUser => dbUser.user);
}
// проверка пользователя среди уже подключенных
function dbUsersCheck(data) {
    for (let dbUser of dbUsers) {
        if (dbUser.user.login == data.login) {
            return true;
        }
    }
    return false;
}
// удаление отключившегося пользователя
function dbUsersRemote(login) {
    for (let i = 0; i < dbUsers.length; i++) {
        if (dbUsers[i].user.login == login) {
            dbUsers.splice(i, 1);
        }
    }
}

// РАБОТА С СОКЕТАМИ
// запуск сервера
var wss = new WebSocket.Server({
    port: 3000
});

// подключение к сокет серверу пользователя
wss.on('connection', function(ws) {
    console.log('Client connected');

    // получение сообщения от клиента
    ws.on('message', function(message) {
        var dataParse = JSON.parse(message);
        
        handlers[dataParse.payload](ws, dataParse.data);
    });

    // отключение клиента
    ws.on('close', function() {
        console.log('Client disconnected');

        for (let dbUser of dbUsers) {
            try {
                sendOne(dbUser.ws, {
                    payload: 'poll',
                    data: 'poll'
                });
            } catch {
                // сначала разослать данные пользователя
                sendAll({
                    payload: 'delUser',
                    data: {
                        login: dbUser.user.login
                    }
                });
                // потом удалить из базы
                dbUsersRemote(dbUser.user.login);
            }
        } 
    })
});

// обработка входящих сообщений
var handlers = {
    'newMessage': function(ws, data) {
        db.get('messages').push(data).write();
        sendAll({
            payload: 'newMessage',
            data
        });
    },
    'newUser': function(ws, dataUser) {
        // проверка данных
        if (!dataUser.login) {
            dataUser.login = 'anonimLogin';
        }
        if (!dataUser.name) {
            dataUser.name = 'anonimName';
        }
        if (dbFotos[dataUser.login]) {
            dataUser.foto = dbFotos[dataUser.login];
        }
        // вернуть данные пользователя
        sendOne(ws, {
            payload: 'infoUser',
            data: dataUser
        });
        //проверка среди текущих пользователей на сервере
        if (!dbUsersCheck(dataUser)) {
            let dbUser = {};
            
            dbUser.user = dataUser;
            dbUser.ws = ws;
            dbUsers.push(dbUser);
            // выслать всем нового пользователя, если он новый
            sendAll({
                payload: 'newUser',
                data: dataUser
            });
        }
        // для подключенного выслать список пользовтелей
        sendOne(ws, {
            payload: 'allUsers',
            data: dbUsersToUsers()
        });
        // рассылка сообщений из базы данных
        sendOne(ws, {
            payload: 'allMessages',
            data: {
                messages: db.get('messages').value()
            }
        });
        // в конце отпрвить имеющиеся фото, т.к. раньше не будет полных списков на клиенте
        sendOne(ws, {
            payload: 'allFotos',
            data: dbFotos
        });
    },
    'newFoto': function(ws, data) {
        let dataLogin = data.login;
        let dataFoto = data.foto;

        dbFotos[dataLogin] = dataFoto;
        sendAll({
            payload: 'newFoto',
            data: {
                login: dataLogin,
                foto: dbFotos[dataLogin]
            }
        });
    }
}

// отправка сообщений
function sendAll(data) {
    wss.clients.forEach(function(client) {
        client.send(JSON.stringify(data));
    });
}
function sendOne(ws, data) {
    ws.send(JSON.stringify(data));
}