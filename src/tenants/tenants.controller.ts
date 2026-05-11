import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../common/types/jwt-payload.type';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant' })
  create(@Body() dto: CreateTenantDto, @CurrentUser() user: JwtUser) {
    return this.tenantsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants for the current user' })
  findAll(@CurrentUser() user: JwtUser) {
    return this.tenantsService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific tenant' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tenantsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tenant (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto, @CurrentUser() user: JwtUser) {
    return this.tenantsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tenant (Admin only)' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tenantsService.remove(id, user.id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List tenant members' })
  getMembers(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tenantsService.getMembers(id, user.id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to the tenant (Admin only)' })
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto, @CurrentUser() user: JwtUser) {
    return this.tenantsService.addMember(id, user.id, dto);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: "Update a member's role (Admin only)" })
  updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tenantsService.updateMember(id, user.id, userId, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the tenant (Admin only)' })
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tenantsService.removeMember(id, user.id, userId);
  }
}
