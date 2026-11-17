import { LegalPage } from '@/components/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Conditions d’utilisation' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Conditions d’utilisation"
      intro={`HOLYDO MARKET, exploité par ${LEGAL.company}, est une plateforme qui met en relation des clients avec des prestataires de services locaux (indépendants et petites entreprises). En créant un compte, vous acceptez les conditions ci-dessous.`}
      sections={[
        {
          h: 'Rôle de la plateforme',
          p: [
            'HOLYDO MARKET facilite la mise en relation. Nous ne sommes pas partie au contrat entre le client et le prestataire : le prix, le déroulement, le paiement et la qualité de la prestation relèvent d’eux seuls.',
            'Les profils des prestataires sont vérifiés par notre équipe avant publication. Cette vérification porte sur le contenu du profil ; elle ne constitue pas une garantie sur les qualifications, les assurances ou les permis du prestataire.',
          ],
        },
        {
          h: 'Comptes',
          p: [
            'Vous devez avoir au moins 18 ans (ou l’âge de la majorité dans votre province) et fournir des informations exactes. Vous êtes responsable de la confidentialité de votre mot de passe et de toute activité sur votre compte.',
          ],
        },
        {
          h: 'Engagements des prestataires',
          p: [
            'Le prestataire s’engage à publier des informations exactes (services, prix, horaires, photos dont il détient les droits), à respecter les lois applicables à son activité (permis, fiscalité, hygiène, assurances) et à répondre aux demandes avec courtoisie.',
            'Nous pouvons refuser, masquer ou suspendre un profil qui ne respecte pas ces conditions, en indiquant la raison au prestataire.',
          ],
        },
        {
          h: 'Engagements des clients',
          p: [
            'Le client s’engage à envoyer des demandes sincères, à se présenter aux rendez-vous acceptés ou à les annuler à l’avance, et à publier des avis honnêtes fondés sur une expérience réelle.',
          ],
        },
        {
          h: 'Avis',
          p: [
            'Seuls les clients dont un rendez-vous a été accepté peuvent laisser un avis. Les avis injurieux, discriminatoires, diffamatoires ou sans rapport avec la prestation peuvent être retirés.',
          ],
        },
        {
          h: 'Contenus interdits',
          p: [
            'Il est interdit de publier des contenus illégaux, trompeurs, haineux ou portant atteinte aux droits d’autrui, et d’utiliser la plateforme pour du démarchage non sollicité ou pour collecter les données d’autres utilisateurs.',
          ],
        },
        {
          h: 'Prix et paiement',
          p: [
            'L’inscription et l’utilisation de la plateforme sont gratuites dans sa version actuelle. Les prestations sont payées directement au prestataire, selon les modalités convenues entre vous.',
          ],
        },
        {
          h: 'Responsabilité',
          p: [
            'Dans la mesure permise par la loi, notamment la Loi sur la protection du consommateur du Québec, HOLYDO MARKET n’est pas responsable des dommages résultant d’une prestation ou d’un litige entre un client et un prestataire. Nous faisons nos meilleurs efforts pour que le service soit disponible, sans pouvoir garantir une disponibilité continue.',
          ],
        },
        {
          h: 'Fermeture du compte',
          p: [`Vous pouvez fermer votre compte à tout moment en écrivant à ${LEGAL.contactEmail}. Nous pouvons suspendre un compte en cas de manquement grave à ces conditions.`],
        },
        {
          h: 'Modifications et droit applicable',
          p: [
            'Nous pouvons modifier ces conditions ; en cas de changement important, nous vous en informerons par courriel ou sur le site. Ces conditions sont régies par les lois du Québec et du Canada.',
            `Contact : ${LEGAL.company}, ${LEGAL.address}, ${LEGAL.contactEmail}.`,
          ],
        },
      ]}
    />
  );
}
