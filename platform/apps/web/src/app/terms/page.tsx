// TODO: legal review required before publishing to production
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos de Servicio — BUMEET',
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-slate-700">
      <h1 className="text-3xl font-black text-slate-900 mb-2">Términos de Servicio</h1>
      <p className="text-sm text-slate-400 mb-10">Última actualización: mayo 2026 — pendiente de revisión legal</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">1. Aceptación</h2>
          <p>Al crear una cuenta o usar el servicio BUMEET (sitio web, dashboard, agente de escritorio, firmware) aceptas estos términos. Si no los aceptas, no uses el servicio.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">2. Descripción del servicio</h2>
          <p>BUMEET es una plataforma que muestra el estado de presencia del usuario en un dispositivo e-ink instalado en la puerta del despacho. El servicio incluye el agente de escritorio, el backend, el dashboard web y el firmware del dispositivo.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">3. Uso aceptable</h2>
          <p>Te comprometes a no usar el servicio para:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Monitorizar a otras personas sin su consentimiento expreso.</li>
            <li>Interferir con el servicio o sus infraestructuras.</li>
            <li>Usar el servicio de forma contraria a la legislación aplicable.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">4. Cuentas</h2>
          <p>Eres responsable de mantener la confidencialidad de tus credenciales y de toda la actividad que ocurra bajo tu cuenta. Notifica cualquier uso no autorizado a <a href="mailto:security@bumeet.es" className="text-sky-600 hover:underline">security@bumeet.es</a>.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">5. Disponibilidad</h2>
          <p>Nos esforzamos por mantener el servicio disponible, pero no garantizamos disponibilidad ininterrumpida. Podemos suspender o modificar el servicio con previo aviso cuando sea razonablemente posible.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">6. Propiedad intelectual</h2>
          <p>BUMEET y sus componentes son propiedad de sus creadores. No se concede ninguna licencia sobre el código fuente, marca o contenido salvo la estrictamente necesaria para usar el servicio.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">7. Limitación de responsabilidad</h2>
          <p>En la máxima medida permitida por la ley, BUMEET no será responsable de daños indirectos, incidentales o consecuentes derivados del uso o la imposibilidad de uso del servicio.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">8. Modificaciones</h2>
          <p>Podemos actualizar estos términos. Te notificaremos con al menos 15 días de antelación para cambios materiales. El uso continuado tras la notificación implica aceptación.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">9. Contacto</h2>
          <p><a href="mailto:hello@bumeet.es" className="text-sky-600 hover:underline">hello@bumeet.es</a></p>
        </div>

        <p className="text-slate-400 italic text-xs mt-8">
          Este documento es un borrador pendiente de revisión legal. No constituye asesoramiento jurídico.
        </p>
      </section>
    </main>
  );
}
