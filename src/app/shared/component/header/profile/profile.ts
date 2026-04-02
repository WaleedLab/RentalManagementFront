import { Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';

import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { Feathericon } from '../../feathericon/feathericon';
import { AuthService } from '../../../services/auth/auth.service';
import { TokenService } from '../../../services/storage/token.service';

const ACCOUNTANT_ROLE_ALIASES = ['accountant', 'accountant_role', 'محاسب'];
const ADMIN_ROLE_ALIASES = ['admin', 'admin_role', 'manager', 'مدير'];
const MAINTENANCE_ROLE_ALIASES = ['maintenance', 'maintenance_role', 'صيانه', 'صيانة'];

@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss'],
  imports: [Feathericon],
})
export class Profile {
  private auth = inject(AuthService);
  private authState = inject(AuthStateService);
  private tokenService = inject(TokenService);
  private hostElement = inject(ElementRef<HTMLElement>);

  readonly defaultAvatar = 'assets/images/user/defulte_user.png';
  readonly superAdminAvatar = 'assets/images/user/super_admin.png';
  readonly adminAvatar = 'assets/images/user/admin.png';
  readonly accountantAvatar = 'assets/images/user/accountant.png';
  readonly maintenanceAvatar = 'assets/images/user/Maintenance.png';
  displayName = signal<string>('User');
  email = signal<string | null>(null);
  roles = signal<string[]>([]);
  avatarUrl = signal<string>(this.getFallbackAvatar());
  isMenuOpen = signal<boolean>(false);

  primaryRole = computed(() => {
    const list = this.roles();
    if (!list || list.length === 0) return 'User';
    return list[0];
  });

  constructor() {
    const token = this.tokenService.getToken();
    const payload = this.tokenService.decodePayload(token);
    if (payload) {
      const avatar =
        payload.imageUrl ??
        payload.ImageUrl ??
        payload.profileImage ??
        payload.profile_image ??
        payload.avatar ??
        payload.picture ??
        payload.url ??
        payload.Url;
      if (avatar && String(avatar).trim()) {
        this.avatarUrl.set(String(avatar).trim());
      } else {
        this.avatarUrl.set(this.getFallbackAvatar());
      }

      const name =
        payload.nameAr ??
        payload.nameEn ??
        payload.fullName ??
        payload.full_name ??
        payload.name ??
        payload.userName ??
        payload.username ??
        payload.unique_name ??
        payload.sub;
      if (name) this.displayName.set(String(name));
      const mail = payload.email ?? payload.Email;
      if (mail) this.email.set(String(mail));
    }
    this.roles.set(this.tokenService.getRoles());
  }

  logout(): void {
    this.auth.logout();
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.isMenuOpen.update(isOpen => !isOpen);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  onLogout(event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.logout();
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: Event): void {
    if (!this.isMenuOpen()) {
      return;
    }

    const target = event.target as Node | null;
    if (target && !this.hostElement.nativeElement.contains(target)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    if (this.isMenuOpen()) {
      this.closeMenu();
    }
  }

  onAvatarError(event: Event): void {
    const imageElement = event.target as HTMLImageElement | null;
    if (!imageElement) {
      return;
    }

    if (imageElement.src.includes(this.defaultAvatar)) {
      return;
    }

    const fallbackAvatar = this.getFallbackAvatar();
    if (imageElement.src.includes(fallbackAvatar)) {
      return;
    }

    imageElement.src = fallbackAvatar;
  }

  private getFallbackAvatar(): string {
    if (this.authState.isSuperAdmin()) {
      return this.superAdminAvatar;
    }

    const roleSet = (this.roles().length ? this.roles() : this.tokenService.getRoles()).map(role =>
      String(role).toLowerCase().trim(),
    );

    if (roleSet.some(role => ADMIN_ROLE_ALIASES.includes(role))) {
      return this.adminAvatar;
    }

    if (roleSet.some(role => MAINTENANCE_ROLE_ALIASES.includes(role))) {
      return this.maintenanceAvatar;
    }

    if (roleSet.some(role => ACCOUNTANT_ROLE_ALIASES.includes(role))) {
      return this.accountantAvatar;
    }

    return this.defaultAvatar;
  }
}
