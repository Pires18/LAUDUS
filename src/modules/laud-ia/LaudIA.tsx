import { SharedLaudIA } from './SharedLaudIA';
import { auth } from '../../lib/firebase';
import { ADMIN_EMAIL } from '../../config/constants';

export function LaudIA() {
  const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;
  return (
    <div className="module-container">
      <SharedLaudIA readOnly={!isAdmin} />
    </div>
  );
}
