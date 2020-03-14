import '../scss/main.scss';
import '../img/ava.png';
import '../img/preview.png';

// глобальные переменные
var socket; 
var user = {};
var fotos = {}
var defaultFoto = '../img/ava.png';
var defaultFotoPreview = '../img/preview.png';
var previousLogin;

// РАЗДЕЛЫ
// welcome
var welcome = document.querySelector('#welcome');
var welcomeLogin = welcome.querySelector('#login');
var welcomeName = welcome.querySelector('#name');
var welcomeSignin = welcome.querySelector('button');
// chat
var chat = document.querySelector('#chat');
var chatUser = chat.querySelector('#user');
var chatLogout = chat.querySelector('#logout');
var chatInput = chat.querySelector('#textInput');
var chatFilter = chat.querySelector('#filter');
var chatSend = chat.querySelector('#send');
var chatMessages = chat.querySelector('#messages');
var chatUsers = chat.querySelector('#list');
var chatUsersNum = chat.querySelector('#usersNum');
var fotoInput = chat.querySelector('#fileInput');
var fotoCancel = chat.querySelector('#fotoCancel')
var fotoSave = chat.querySelector('#fotoSave')
var fotoPreview = chat.querySelector('#previewFoto');
// выбор раздела
function page(pageName) {
    if (pageName == "welcome") {
        chat.style.display = 'none';
        welcome.style.display = 'block';
    } else if (pageName == 'chat') {
        chat.style.display = 'block';
        welcome.style.display = 'none';
    }
}

// начало работы приложения
window.addEventListener('DOMContentLoaded', function() {
    page('welcome');
});
// запуск сокета и отправка данных регистрации
welcomeSignin.addEventListener('click', function() {
    page('chat');

    let initUser = {};

    initUser.name = welcomeName.value;
    initUser.login = welcomeLogin.value;
    initUser.foto = defaultFoto;

    initSockets(initUser);

    welcomeLogin.value = '';
    welcomeName.value = '';
});
// выход из чата, закрытие сокета
chatLogout.addEventListener('click', function() {
    socket.close();
    page('welcome');
});

// РАБОТА С СОКЕТОМ
// запуск сокета
function initSockets(initUser) {
    var ws = new WebSocket('ws://localhost:3000');
    socket = ws;

    ws.onopen = function(e) {
        console.log('Connection on');

        sendMessage(socket, {
            payload: 'newUser',
            data: initUser
        });
    }
    ws.onmessage = function(e) {
        var dataParse = JSON.parse(e.data);

        handlers[dataParse.payload](dataParse.data);
    }
    ws.onclose = function(e) {
        console.log('Connection off');
        socket.close();
        page('welcome');
    }
    ws.onerror = function(e) {
        console.log(e.messages);
    }
}
// отправка нового сообщения
chatSend.addEventListener('click', function(e) {
    sendMessage(socket, {
        payload: 'newMessage',
        data: {
            text: chatInput.value,
            login: user.login,
            date: date()
        }
    });
    chatInput.value = '';
});
// отправка сообщений на сервер
function sendMessage(socket, data) {
    socket.send(JSON.stringify(data));
}
// проверка чьи сообщения
function messageTemplate(message) {
    if (message.login == user.login) {
        return 'messageMy';
    }
    return 'messageMe';
}
// рендер
function render(templateName, data = '') {
    return require(`../views/blocks/${templateName}.hbs`)(data)
}

// функции обработки сообщений с сервера
var handlers = {
    'newMessage': function(dataMessage) {
        dataMessage.foto = fotoSearch([dataMessage.login]);
        dataMessage.fotoStyle = fotoHide(dataMessage.login);
        chatMessages.innerHTML += render(messageTemplate(dataMessage), dataMessage);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    'allMessages': function(dataMessages) {
        chatMessages.innerHTML = ''; 
        dataMessages.messages.forEach(function(dataMessage) {
            dataMessage.foto = fotoSearch([dataMessage.login]);
            dataMessage.fotoStyle = fotoHide(dataMessage.login);
            chatMessages.innerHTML += render(messageTemplate(dataMessage), dataMessage);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    'infoUser': function(dataUser) {
        // обновить данные о пользователе
        user.name = dataUser.name;
        user.login = dataUser.login;
        user.foto = dataUser.foto;
        // обновить профиль пользователя
        chat.querySelector('#userName').textContent = dataUser.name;
        chat.querySelector('#userLogin').textContent = dataUser.login;
        chatUser.querySelector('#userFoto').src = dataUser.foto;
    },
    'newUser': function(dataUser) {
        // добавить нового пользователя в список, только если этот список не пуст. сам себя пользователь получит из 'allUsers'
        if (chatUsers.innerHTML) {
            chatUsers.innerHTML += render('user', dataUser);    
        }
        this['numUsers']();
    },
    'delUser': function(dataUser) {
        // удалить пользователя из списка
        chatUsers.querySelector(`#${dataUser.login}`).remove();
        this['numUsers']();
    },
    'numUsers': function() {
        // в фильтре не удалять, а скрывать
        chatUsersNum.textContent = `Пользователей: ${chatUsers.children.length}`;
    },
    'allUsers': function(dataUsers) {
        chatUsers.innerHTML = '';
        dataUsers.forEach(function(dataUser) {
            // рендер пользователей
            chatUsers.innerHTML += render('user', dataUser);
        });
        userFirst();
        this['numUsers']();
    },
    'newFoto': function(dataFoto) {
        // заполнение локального архива фото
        fotos[dataFoto.login] = dataFoto.foto;
        // обновить фото пользователя
        if (user.login == dataFoto.login) {
            chatUser.querySelector('#userFoto').src = fotos[user.login];
        }
        // обновить фото в списке пользователей
        for (let child of chatUsers.children) {
            if (child.id == dataFoto.login) {
                child.querySelector('#userFoto').src = fotos[child.id];
            }
        }
        // обновить фото в чате
        for (let child of chatMessages.children) {
            if (child.id == dataFoto.login) {
                child.querySelector('#foto').src = fotos[child.id];
            }
        }
        // вывести первым текущего
        usersFilter();
    },
    'allFotos': function(dataFotos) {
        // заполнение локального архива фото
        fotos = dataFotos;
        // обновить фото пользователя
        chatUser.querySelector('#userFoto').src = fotoSearch(user.login);
        // обновить в списке пользователей
        for (let child of chatUsers.children) {
            child.querySelector('#userFoto').src = fotoSearch(child.id);
        }
        // обновить содержимое чата
        for (let child of chatMessages.children) {
            child.querySelector('#foto').src = fotoSearch(child.id);
        }
    },
    'poll': function() {
        // используется сервером для определения подклченных пользователей
    }
}

// РАБОТА С ФОТО
const fileReader = new FileReader();
var fotoReader;
// дефолтное фото для превью
fotoPreview.src = defaultFotoPreview;
// выбор из файлов системы
fotoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];

    if (file && file.size <= 300 * 1024) {
        fileReader.readAsDataURL(file);       
        fileReader.addEventListener('load', function(e) {
            fotoReader = fileReader.result;
            fotoPreview.src = fotoReader;
        });
    }
}); 
// отправить фото на сервер
fotoSave.addEventListener('click', function() {
    if (fotoReader) {
        sendMessage(socket, {
            payload: 'newFoto',
            data: {
                login: user.login,
                foto: fotoReader
            }
        });
    }
    fotoPreview.src = defaultFotoPreview;
});
// отменить выбор фото
fotoCancel.addEventListener('click', function() {
    fotoReader = '';
    fileReader.abort()
    console.log(fotoReader)
    fotoPreview.src = defaultFotoPreview;
})
// вставка фото в чат
function fotoHide(currentLogin) {
    if (currentLogin == previousLogin) {
        previousLogin = currentLogin;
        return 'visibility: hidden;'
    } else {
        previousLogin = currentLogin;
        return 'visibility: visible';
    }
}
// поиск фото в имеющихся
function fotoSearch(login) {
    let foto = defaultFoto;
    if (fotos[login]) {
        foto = fotos[login];
    }
    return foto;
}

// ФИЛЬТРЫ
// вызов при вводе текста
chatFilter.addEventListener('keyup', function(e) {
    usersFilter();
});
// проверка наличия в имени и логине
function isMatching(strFull, strPart) {
    if (strPart) {
        return strFull.toLowerCase().includes(strPart.toLowerCase());
    }
    return true;
}
// фильтр не должен удалять, только скрывать
function usersFilter() {
    let str = chatFilter.value;

    for (let child of chatUsers.children) {
        if (isMatching(child.id, str) || isMatching(child.querySelector('#userName').textContent, str)) {
            child.style.display = 'block';
        } else {
            child.style.display = 'none';
        }
    }
}
// вывести пользовтеля первым в список
function userFirst() {
    for (let child of chatUsers.children) {
        if (child.id == user.login) {
            chatUsers.prepend(child);
        }
    }
}
// дата 
function date() {
    let date = new Date();
    let hours = date.getHours();
    let minutes = date.getMinutes();

    if (hours <= 9) {
        hours = '0' + hours;
    }
    if (minutes <= 9) {
        minutes = '0' + minutes;
    }
    // let myDate = `${date.getFullYear()}.${date.getMonth()}.${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;

    return `${hours}:${minutes}`;
}