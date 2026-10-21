fetch("http://localhost:3000/api/cron/recordatorios", {
  method: "GET",
  headers: { "authorization": "Bearer clave_de_prueba_123" }
})
.then(res => res.json())
.then(data => console.log("Respuesta:", data))
.catch(err => console.error("Error:", err));