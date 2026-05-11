import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slug';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

const ROLE_LEVEL: Record<Role, number> = {
  [Role.VIEWER]: 1,
  [Role.MEMBER]: 2,
  [Role.ADMIN]: 3,
  [Role.SUPER_ADMIN]: 4,
};

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTenantDto) {
    const slug = await this.uniqueSlug(slugify(dto.name));
    const tenant = await this.prisma.tenant.create({ data: { name: dto.name, slug } });
    await this.prisma.userTenant.create({
      data: { userId, tenantId: tenant.id, role: Role.ADMIN },
    });
    return tenant;
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.userTenant.findMany({
      where: { userId },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.tenant, role: m.role }));
  }

  async findOne(tenantId: string, userId: string) {
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { tenant: true },
    });
    if (!membership) throw new NotFoundException('Tenant not found');
    return { ...membership.tenant, role: membership.role };
  }

  async update(tenantId: string, userId: string, dto: UpdateTenantDto) {
    await this.requireRole(tenantId, userId, [Role.ADMIN, Role.SUPER_ADMIN]);
    return this.prisma.tenant.update({ where: { id: tenantId }, data: dto });
  }

  async remove(tenantId: string, userId: string) {
    await this.requireRole(tenantId, userId, [Role.ADMIN, Role.SUPER_ADMIN]);
    return this.prisma.tenant.delete({ where: { id: tenantId } });
  }

  async getMembers(tenantId: string, userId: string) {
    await this.requireMembership(tenantId, userId);
    return this.prisma.userTenant.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(tenantId: string, requesterId: string, dto: AddMemberDto) {
    const requester = await this.requireRole(tenantId, requesterId, [Role.ADMIN, Role.SUPER_ADMIN]);
    const assignedRole = dto.role ?? Role.MEMBER;
    if (ROLE_LEVEL[assignedRole] > ROLE_LEVEL[requester.role]) {
      throw new ForbiddenException('Cannot assign a role higher than your own');
    }
    const target = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!target) throw new NotFoundException('User not found');
    return this.prisma.userTenant.create({
      data: { userId: target.id, tenantId, role: assignedRole },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async updateMember(
    tenantId: string,
    requesterId: string,
    targetUserId: string,
    dto: UpdateMemberDto,
  ) {
    const requester = await this.requireRole(tenantId, requesterId, [Role.ADMIN, Role.SUPER_ADMIN]);
    if (ROLE_LEVEL[dto.role] > ROLE_LEVEL[requester.role]) {
      throw new ForbiddenException('Cannot assign a role higher than your own');
    }
    return this.prisma.userTenant.update({
      where: { userId_tenantId: { userId: targetUserId, tenantId } },
      data: { role: dto.role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async removeMember(tenantId: string, requesterId: string, targetUserId: string) {
    await this.requireRole(tenantId, requesterId, [Role.ADMIN, Role.SUPER_ADMIN]);
    await this.prisma.userTenant.delete({
      where: { userId_tenantId: { userId: targetUserId, tenantId } },
    });
  }

  private async requireMembership(tenantId: string, userId: string): Promise<void> {
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this tenant');
  }

  private async requireRole(
    tenantId: string,
    userId: string,
    roles: Role[],
  ): Promise<{ role: Role }> {
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!membership || !roles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return membership;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let i = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }
}
