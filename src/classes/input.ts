import {Subject, Observable, filter} from 'rxjs';

export interface InputKeyEvent {
    keyCode: number,
    value: boolean
};

export class Input {
    private keys: {[key: number]: boolean} = [];
    private onKeyPressSubject: Subject<InputKeyEvent> = new Subject<InputKeyEvent>();

    constructor() {
    }

    private listenToKeyEvents(): void {
        window.addEventListener('keydown', (e) => {
            // Detect when the key press is a change and fire an event
            if (!this.keys[e.keyCode]) {
                this.onKeyPressSubject.next({
                    keyCode: e.keyCode,
                    value: true
                });
            }

            this.keys[e.keyCode] = true;
        }, false);

        window.addEventListener('keyup', (e) => {
            this.keys[e.keyCode] = false;
        }, false);
    }

    start() {
        this.listenToKeyEvents();
    }

    getKeyState(keyCode: number): boolean {
        return this.keys && this.keys.hasOwnProperty(keyCode) ? 
            this.keys[keyCode] : false;
    }

    onKeyPress(keyCode: number): Observable<InputKeyEvent> {
        return this.onKeyPressSubject
            .pipe(filter(k => k.keyCode === keyCode));
    }
}