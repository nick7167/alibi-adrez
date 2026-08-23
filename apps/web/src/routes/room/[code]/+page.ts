import { redirect } from '@sveltejs/kit';
import { isValidRoomCode } from '@alibi/shared';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const code = params.code.trim().toUpperCase();
	if (!isValidRoomCode(code)) redirect(308, '/');
	return { code };
};
