import { Component, HostListener } from '@angular/core';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.html',
  styleUrls: ['./notification.scss'],
  imports: [],
})
export class Notification {
  public isOpen = false;

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  @HostListener('document:click')
  closeDropdown(): void {
    this.isOpen = false;
  }
}
