// Thin wrapper around the Toastify library (loaded globally via CDN script
// tag in index.html — not an npm/ES import, since this project has no
// build step).
export function toast(text, duration = 5000) {
    Toastify({
        text: text,
        duration: duration,
        destination: "",
        className: "toast",
        newWindow: true,
        close: false,
        gravity: "top",
        position: "right",
        stopOnFocus: true,
        style: {
            background: "#0000009b",
        },
        onClick: function () {} // Callback after click
    }).showToast();
}
