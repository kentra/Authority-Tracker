// Ensure this browser has a stored display name *before* anything connects
// to Socket.IO — socket.js reads `localStorage.getItem('user')` as soon as
// it joins the shared "tts" room, so this must run first. Import this as
// the very first line of socket.js (import order = evaluation order) rather
// than relying on module load order elsewhere.
if (!localStorage.getItem("user")) {
    const username = prompt("Please enter your name", "");
    localStorage.setItem('user', username);
}
