import { LegalPage } from '@/components/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Politique de confidentialité' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro={`Cette politique explique quels renseignements personnels HOLYDJO MARKET (${LEGAL.company}) recueille, pourquoi, avec qui ils sont partagés et quels sont vos droits, conformément à la Loi sur la protection des renseignements personnels dans le secteur privé du Québec (Loi 25) et à la LPRPDE.`}
      sections={[
        {
          h: 'Renseignements recueillis',
          p: [
            'Compte : prénom, nom, adresse courriel, téléphone (facultatif), mot de passe (stocké uniquement sous forme chiffrée irréversible), rôle, date d’acceptation des conditions.',
            'Prestataires : informations du profil public (nom affiché, description, services, prix, photos, horaires, quartier, ville, zone de déplacement) et adresse. L’adresse exacte n’est publique que pour un salon ou une boutique ; sinon, elle n’est transmise qu’aux clients dont le rendez-vous est accepté.',
            'Demandes de rendez-vous et avis : date souhaitée, message, adresse d’intervention si le prestataire se déplace, note et commentaire.',
            'Localisation : si vous utilisez « Autour de moi », votre position est utilisée pour la recherche seulement et n’est pas enregistrée dans votre compte.',
          ],
        },
        {
          h: 'Utilisation',
          p: [
            'Fournir le service (recherche, profils, demandes de rendez-vous, avis), vérifier les profils avant publication, envoyer les courriels liés à votre compte (bienvenue, demandes, réponses, réinitialisation du mot de passe), assurer la sécurité (limitation des tentatives de connexion) et répondre à vos demandes. Nous n’envoyons pas de publicité et ne vendons pas vos renseignements.',
          ],
        },
        {
          h: 'Partage',
          p: [
            'Entre utilisateurs : le client voit le profil public du prestataire ; le prestataire voit le prénom et le message du client, puis son courriel et son téléphone une fois la demande acceptée.',
            'Fournisseurs techniques, uniquement pour faire fonctionner le service : hébergement du site et de l’API (Vercel, Render), stockage des photos (Cloudinary), envoi des courriels (fournisseur SMTP), recherche d’adresses et cartes (OpenStreetMap / Photon : le texte saisi dans le champ d’adresse et l’affichage des cartes passent par leurs serveurs). Certains de ces fournisseurs peuvent traiter les données hors du Québec ; nous choisissons des fournisseurs offrant une protection adéquate.',
          ],
        },
        {
          h: 'Conservation',
          p: [
            'Vos renseignements sont conservés tant que votre compte est actif, puis supprimés ou anonymisés dans un délai raisonnable après sa fermeture, sauf obligation légale de conservation. Les liens de réinitialisation de mot de passe expirent après 1 heure.',
          ],
        },
        {
          h: 'Témoins (cookies)',
          p: [
            'Le site n’utilise pas de témoins publicitaires ni d’outil de suivi. Seul un jeton de connexion est conservé dans votre navigateur pour vous garder connecté.',
          ],
        },
        {
          h: 'Sécurité',
          p: [
            'Connexions chiffrées (HTTPS), mots de passe chiffrés, accès administrateur restreint, journal des décisions de modération et limitation des tentatives de connexion. En cas d’incident de confidentialité présentant un risque de préjudice sérieux, nous vous aviserons ainsi que la Commission d’accès à l’information.',
          ],
        },
        {
          h: 'Vos droits',
          p: [
            'Vous pouvez demander l’accès à vos renseignements, leur rectification, leur suppression ou leur portabilité, et retirer votre consentement. Écrivez-nous à l’adresse ci-dessous ; nous répondons dans un délai de 30 jours. Vous pouvez aussi porter plainte auprès de la Commission d’accès à l’information du Québec.',
          ],
        },
        {
          h: 'Responsable de la protection des renseignements personnels',
          p: [`${LEGAL.privacyOfficer} — ${LEGAL.privacyEmail} — ${LEGAL.company}, ${LEGAL.address}.`],
        },
      ]}
    />
  );
}
