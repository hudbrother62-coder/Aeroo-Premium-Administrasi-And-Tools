import {NextResponse} from 'next/server';
export async function PATCH(){return NextResponse.json({error:'Gunakan database anggota terpadu /api/members.'},{status:410})}
export async function DELETE(){return NextResponse.json({error:'Gunakan arsip pada database anggota terpadu.'},{status:410})}
