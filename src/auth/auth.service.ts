import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slug';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const [hashed, slug] = await Promise.all([
      bcrypt.hash(dto.password, 10),
      this.uniqueSlug(slugify(dto.tenantName)),
    ]);

    const [user, tenant] = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email: dto.email, password: hashed, name: dto.name },
      });
      const t = await tx.tenant.create({ data: { name: dto.tenantName, slug } });
      await tx.userTenant.create({ data: { userId: u.id, tenantId: t.id, role: Role.ADMIN } });
      return [u, t] as const;
    });

    const accessToken = this.signToken(user.id, user.email, tenant.id, Role.ADMIN);
    return { accessToken, user: this.safeUser(user), tenant: this.safeTenant(tenant) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    let tenantId: string;
    let role: Role;

    if (dto.tenantId) {
      const membership = await this.prisma.userTenant.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId: dto.tenantId } },
        include: { tenant: true },
      });
      if (!membership?.tenant.isActive) throw new NotFoundException('Tenant not found or inactive');
      tenantId = dto.tenantId;
      role = membership.role;
    } else {
      const first = await this.prisma.userTenant.findFirst({
        where: { userId: user.id, tenant: { isActive: true } },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!first) throw new NotFoundException('No active tenant found for this user');
      tenantId = first.tenantId;
      role = first.role;
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const accessToken = this.signToken(user.id, user.email, tenantId, role);
    return { accessToken, user: this.safeUser(user), tenant: this.safeTenant(tenant) };
  }

  private signToken(sub: string, email: string, tenantId: string, role: Role): string {
    const payload: JwtPayload = { sub, email, tenantId, role };
    return this.jwt.sign(payload);
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let i = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  private safeUser(user: { id: string; email: string; name: string | null }) {
    return { id: user.id, email: user.email, name: user.name };
  }

  private safeTenant(tenant: { id: string; name: string; slug: string }) {
    return { id: tenant.id, name: tenant.name, slug: tenant.slug };
  }
}
