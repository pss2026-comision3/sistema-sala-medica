import Link from "next/link";

export default function AdminPacientesPage() {
  return (
    <>
      {/* Le agregamos flex y justify-between para que el botón quede alineado a la derecha de los textos */}
      <div className="sigsam-page-head flex justify-between items-center">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Pacientes</h1>
          <p>Alta, búsqueda y datos de las personas registradas.</p>
        </div>
        
        {/* Acá agregamos nuestro botón hacia tu nueva User Story */}
        <div>
          <Link 
            href="/admin/pacientes/nuevo-menor" 
            className="bg-teal-700 !text-white px-4 py-2 rounded-md hover:bg-teal-800 transition-colors font-medium shadow-sm inline-block"
          >
            + Registrar Menor
          </Link>
        </div>
      </div>
      
      <div className="sigsam-empty">
        <p>El listado general de pacientes se incorpora en otra historia de usuario.</p>
      </div>
    </>
  );
}