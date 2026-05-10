// TODO: legal review required before publishing to production
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad — BUMEET',
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-slate-700">
      <h1 className="text-3xl font-black text-slate-900 mb-2">Política de Privacidad</h1>
      <p className="text-sm text-slate-400 mb-10">Última actualización: mayo 2026 — pendiente de revisión legal</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">1. Responsable del tratamiento</h2>
          <p>BUMEET · hello@bumeet.es · bumeet.es</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">2. Qué datos recogemos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Datos de cuenta:</strong> nombre, dirección de email, proveedor OAuth utilizado para iniciar sesión (Google, Microsoft, Slack).</li>
            <li><strong>Estado de presencia:</strong> el agente de escritorio detecta si el micrófono o la cámara están en uso y envía un estado binario (libre / ocupado) cifrado al servidor. No se graba ni transmite audio ni vídeo en ningún momento.</li>
            <li><strong>Eventos de calendario:</strong> si conectas Google Calendar o Microsoft Outlook, sincronizamos los metadatos de tus eventos (título, hora de inicio, hora de fin) para determinar tu disponibilidad. No leemos el cuerpo ni los adjuntos de los eventos.</li>
            <li><strong>Datos técnicos:</strong> dirección IP, agente de usuario, logs de acceso a la API con retención de 7 días.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">3. Para qué usamos los datos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Mostrar tu estado de presencia en el dispositivo físico de la puerta.</li>
            <li>Sincronizar tu estado con los servicios que hayas autorizado (Slack, Teams, Zoom, Webex).</li>
            <li>Operar y mejorar el servicio.</li>
          </ul>
          <p className="mt-2">No vendemos datos personales a terceros ni los usamos para publicidad.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">4. Base legal</h2>
          <p>Ejecución del contrato (art. 6.1.b RGPD) para los datos necesarios para prestar el servicio. Consentimiento (art. 6.1.a RGPD) para cookies no esenciales y sincronización de integraciones opcionales.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">5. Conservación</h2>
          <p>Los datos de cuenta se conservan mientras la cuenta esté activa. Los eventos de calendario sincronizados se eliminan a los 90 días o cuando desconectas la integración. Los logs técnicos se eliminan a los 7 días.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">6. Tus derechos</h2>
          <p>Puedes acceder, rectificar, eliminar, portarte o limitar el tratamiento de tus datos escribiendo a <a href="mailto:privacy@bumeet.es" className="text-sky-600 hover:underline">privacy@bumeet.es</a>. También puedes eliminar tu cuenta desde el dashboard, lo que eliminará todos tus datos en un plazo de 30 días.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">7. Cookies</h2>
          <p>Usamos cookies estrictamente necesarias para la sesión autenticada. Con tu consentimiento, podemos usar cookies de análisis de uso (sin publicidad). Puedes retirar el consentimiento en cualquier momento eliminando las cookies de tu navegador.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">8. Transferencias internacionales</h2>
          <p>Los datos se alojan en servidores de Microsoft Azure en Europa Occidental (West Europe). Las integraciones con proveedores de terceros (Google, Microsoft, Slack, Zoom, Webex) implican transferencias a sus respectivas infraestructuras, cubiertas por sus propias políticas de privacidad y mecanismos de transferencia adecuados.</p>
        </div>

        <p className="text-slate-400 italic text-xs mt-8">
          Este documento es un borrador pendiente de revisión legal. No constituye asesoramiento jurídico.
        </p>
      </section>
    </main>
  );
}
